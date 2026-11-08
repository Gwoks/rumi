//! Auth endpoints #7–#12 (PRD §5.8.3).

use axum::extract::State;
use axum::http::header::{SET_COOKIE, USER_AGENT};
use axum::http::{HeaderMap, HeaderValue};
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};

use crate::auth::password::{hash_async, verify_async};
use crate::auth::session::{self, clear_cookie, set_cookie, wants_secure};
use crate::auth::OptionalUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{client_ip, ApiJson};
use crate::ids::{gen_token, hash_secret, TOKEN_BYTES};
use crate::middleware::{auth_rate_limit, take_token};
use crate::models::child::{self, CHILD_SPECS};
use crate::models::user::{self, NewUser, ROLE_PARENT};
use crate::state::AppState;
use crate::validate::{body_object, parse_create, Changes, Errors, Reader, Rule, PASSWORD};

const RESET_TTL_MINUTES: i64 = 60;
/// Login-failure bucket per normalized email (§5.3.4): 5 per 15 minutes.
const LOGIN_FAILURE_LIMIT: i64 = 5;
const LOGIN_FAILURE_WINDOW_SECS: i64 = 15 * 60;
/// Marks every still-unused reset token of one user used (§5.8.3 #11, #12).
const BURN_UNUSED_RESETS: &str =
    "UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL";

fn login_failure_key(email: &str) -> String {
    format!("login-fail:{email}")
}

/// Rate-limited (§5.3.4) and public auth routes.
pub fn router(state: AppState) -> Router<AppState> {
    let limited = Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
        .route_layer(axum::middleware::from_fn_with_state(state, auth_rate_limit));
    Router::new()
        .merge(limited)
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
}

fn with_cookie(mut resp: Response, cookie: &str) -> Response {
    if let Ok(value) = HeaderValue::from_str(cookie) {
        resp.headers_mut().append(SET_COOKIE, value);
    }
    resp
}

struct Client {
    ip: String,
    user_agent: Option<String>,
    secure: bool,
}

fn client(state: &AppState, headers: &HeaderMap, extensions: &axum::http::Extensions) -> Client {
    Client {
        ip: client_ip(extensions, headers),
        user_agent: headers
            .get(USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string),
        secure: wants_secure(&state.cfg, headers),
    }
}

struct RegisterInput {
    full_name: String,
    email: String,
    phone_wa: String,
    password: String,
    child: Changes,
}

fn parse_register(body: &Value) -> Result<RegisterInput, ApiError> {
    let errs = Errors::new();
    let r = Reader::new(body_object(body)?, &errs);
    let parent = r.object("parent");
    let child = r.object("child");
    let read = |key: &str, rule: Rule| {
        parent
            .as_ref()
            .map(|p| p.req_string(key, rule))
            .unwrap_or_default()
    };
    let input = RegisterInput {
        full_name: read("full_name", Rule::Text { min: 2, max: 100 }),
        email: read("email", Rule::Email),
        phone_wa: read("phone_wa", Rule::Phone),
        password: read("password", PASSWORD),
        child: child
            .map(|c| parse_create(&c, &CHILD_SPECS))
            .unwrap_or_default(),
    };
    errs.finish()?;
    Ok(input)
}

/// #7: parent + first child + session in one transaction; role is always PARENT.
async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    extensions: axum::http::Extensions,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let input = parse_register(&body)?;
    let who = client(&state, &headers, &extensions);
    let password_hash = hash_async(input.password.clone()).await?;
    let mut tx = crate::db::begin_immediate(&state.pool).await?;
    if user::email_exists(&mut *tx, &input.email).await? {
        return Err(ApiError::email_taken());
    }
    let new_user = NewUser {
        email: &input.email,
        password_hash: &password_hash,
        full_name: &input.full_name,
        phone_wa: &input.phone_wa,
        role: ROLE_PARENT,
    };
    let user_id = user::insert(&mut *tx, &new_user)
        .await
        .map_err(map_email_taken)?;
    let child_id = child::insert(&mut *tx, user_id, &input.child).await?;
    let ttl = state.cfg.session_ttl_days;
    let token = session::create(&mut *tx, user_id, ttl, who.user_agent.as_deref(), &who.ip).await?;
    tx.commit().await?;
    let user = user::find_active(&state.pool, user_id)
        .await?
        .ok_or_else(ApiError::internal)?;
    let child = child::find_active(&state.pool, child_id)
        .await?
        .ok_or_else(ApiError::internal)?;
    let resp = created(json!({ "user": user, "child": child }))?;
    let cookie = set_cookie(&token, state.cfg.session_ttl_seconds(), who.secure);
    Ok(with_cookie(resp, &cookie))
}

fn map_email_taken(e: sqlx::Error) -> ApiError {
    match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => ApiError::email_taken(),
        _ => ApiError::from(e),
    }
}

/// #8: email + password → session cookie; a previous session cookie is revoked.
async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    extensions: axum::http::Extensions,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let email = r.req_string("email", Rule::Email);
    let password = r.req_string("password", Rule::Secret { min: 1, max: 128 });
    errs.finish()?;

    // Every attempt takes a token up front (so a parallel burst cannot slip
    // past the check); a success clears the bucket, so only failures count.
    let failure_key = login_failure_key(&email);
    take_token(
        &state.limiter,
        &failure_key,
        LOGIN_FAILURE_LIMIT,
        LOGIN_FAILURE_WINDOW_SECS,
    )?;
    let row = user::login_row(&state.pool, &email).await?;
    let user_id = row.as_ref().map(|(id, _)| *id);
    let verified = verify_async(row.map(|(_, h)| h), password).await?;
    let Some(user_id) = user_id.filter(|_| verified) else {
        return Err(ApiError::invalid_credentials());
    };
    state.limiter.clear(&failure_key);
    if let Some(old) = session::session_token(&headers) {
        session::revoke(&state.pool, &old).await?;
    }
    let who = client(&state, &headers, &extensions);
    let ttl = state.cfg.session_ttl_days;
    let token = session::create(
        &state.pool,
        user_id,
        ttl,
        who.user_agent.as_deref(),
        &who.ip,
    )
    .await?;
    let user = user::find_active(&state.pool, user_id)
        .await?
        .ok_or_else(ApiError::internal)?;
    let resp = ok(json!({ "user": user }))?;
    let cookie = set_cookie(&token, state.cfg.session_ttl_seconds(), who.secure);
    Ok(with_cookie(resp, &cookie))
}

/// #9: always `200 null` and a cleared cookie.
async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult {
    if let Some(token) = session::session_token(&headers) {
        session::revoke(&state.pool, &token).await?;
    }
    let secure = wants_secure(&state.cfg, &headers);
    Ok(with_cookie(ok(())?, &clear_cookie(secure)))
}

/// #10: `{ user: User | null }`, never 401.
async fn me(OptionalUser(user): OptionalUser) -> ApiResult {
    ok(json!({ "user": user }))
}

/// A fresh 60-minute reset token for `user_id`; older unused ones are burned
/// first so only the newest link works (§5.8.3 #11).
async fn issue_reset_token(pool: &sqlx::SqlitePool, user_id: i64) -> Result<String, ApiError> {
    let token = gen_token(TOKEN_BYTES);
    let mut tx = crate::db::begin_immediate(pool).await?;
    sqlx::query(BURN_UNUSED_RESETS)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES (?, ?, datetime('now', ?))",
    )
    .bind(user_id)
    .bind(hash_secret(&token))
    .bind(format!("+{RESET_TTL_MINUTES} minutes"))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(token)
}

/// #11: always `200 null`; a live account gets a 60-minute single-use link
/// whose token rides in the URL fragment (never sent to a server log).
async fn forgot_password(
    State(state): State<AppState>,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let email = r.req_string("email", Rule::Email);
    errs.finish()?;

    if let Some((user_id, _)) = user::login_row(&state.pool, &email).await? {
        let token = issue_reset_token(&state.pool, user_id).await?;
        let url = format!("{}/reset-password#token={token}", state.cfg.link_base());
        if let Err(e) = state.notifier.send_password_reset(&email, &url) {
            tracing::error!(error = %e, "password reset notification failed");
        }
    }
    ok(())
}

/// #12: set the new password, burn every unused token of the user, revoke
/// every session.
async fn reset_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let token = r.req_string("token", Rule::Text { min: 1, max: 200 });
    let password = r.req_string("password", PASSWORD);
    errs.finish()?;

    let found: Option<(i64, i64)> = sqlx::query_as(
        "SELECT pr.id, pr.user_id FROM password_resets pr JOIN users u ON u.id = pr.user_id
         WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > datetime('now')
           AND u.deleted_at IS NULL",
    )
    .bind(hash_secret(&token))
    .fetch_optional(&state.pool)
    .await?;
    let (reset_id, user_id) = found.ok_or_else(ApiError::invalid_token)?;
    let password_hash = hash_async(password).await?;

    let mut tx = crate::db::begin_immediate(&state.pool).await?;
    let burned = sqlx::query(
        "UPDATE password_resets SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL",
    )
    .bind(reset_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if burned != 1 {
        return Err(ApiError::invalid_token());
    }
    sqlx::query(BURN_UNUSED_RESETS)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(&password_hash)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    session::revoke_all(&mut *tx, user_id).await?;
    tx.commit().await?;
    let secure = wants_secure(&state.cfg, &headers);
    Ok(with_cookie(ok(())?, &clear_cookie(secure)))
}

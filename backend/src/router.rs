//! Top-level router (hookbox `router.rs` + PRD §5.12).
//!
//! Layers, innermost first: body limit → `api_guard` (Origin/size/no-store/
//! envelope fallthrough) → `CatchPanicLayer` (500 envelope) → security headers
//! → `TraceLayer` (method + path only: never headers, cookies, query or bodies).

use std::any::Any;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::header::{
    CACHE_CONTROL, CONTENT_SECURITY_POLICY, REFERRER_POLICY, X_CONTENT_TYPE_OPTIONS,
    X_FRAME_OPTIONS,
};
use axum::http::{HeaderName, HeaderValue, Request};
use axum::middleware::from_fn_with_state;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::{DefaultOnResponse, TraceLayer};
use tracing::Level;

use crate::error::ApiError;
use crate::middleware::{api_guard, is_api_path, MAX_BODY_BYTES};
use crate::routes::{api_router, health, spa};
use crate::state::AppState;

const CSP: &str = "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; \
font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const SECURITY_HEADERS: [(HeaderName, &str); 4] = [
    (X_CONTENT_TYPE_OPTIONS, "nosniff"),
    (X_FRAME_OPTIONS, "DENY"),
    (REFERRER_POLICY, "strict-origin-when-cross-origin"),
    (CONTENT_SECURITY_POLICY, CSP),
];

/// Unknown `/api/*` → JSON 404 (never the SPA); everything else → SPA.
async fn fallback(state: State<AppState>, req: Request<Body>) -> Response {
    if is_api_path(req.uri().path()) {
        return ApiError::not_found().into_response();
    }
    spa::serve_spa(state, req).await
}

fn panic_response(_err: Box<dyn Any + Send + 'static>) -> Response {
    tracing::error!("handler panicked");
    let mut resp = ApiError::internal().into_response();
    resp.headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    resp
}

pub fn build_app(state: AppState) -> Router {
    let routes = Router::new()
        .merge(api_router(state.clone()))
        .route("/healthz", get(health::healthz))
        .fallback(fallback);
    let routes = add_test_only_routes(routes)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(from_fn_with_state(state.clone(), api_guard))
        .layer(CatchPanicLayer::custom(panic_response));
    let secured = SECURITY_HEADERS
        .into_iter()
        .fold(routes, |router, (name, value)| {
            router.layer(SetResponseHeaderLayer::overriding(
                name,
                HeaderValue::from_static(value),
            ))
        });
    secured
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|req: &Request<Body>| {
                    tracing::info_span!("http", method = %req.method(), path = %req.uri().path())
                })
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .with_state(state)
}

/// No-op in every real build.
#[cfg(not(test))]
fn add_test_only_routes(router: Router<AppState>) -> Router<AppState> {
    router
}

/// `GET /api/__panic` for the CatchPanic regression test (unit tests only).
#[cfg(test)]
fn add_test_only_routes(router: Router<AppState>) -> Router<AppState> {
    async fn boom() -> Response {
        panic!("test-only panic")
    }
    router.route("/api/__panic", get(boom))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    /// A panicking handler becomes the `500 internal` envelope (CatchPanicLayer),
    /// and the app keeps serving afterwards.
    #[tokio::test]
    async fn panic_becomes_500_envelope() {
        let state = AppState::new(crate::testutil::pool().await, crate::testutil::config());
        let app = build_app(state);
        let req = Request::builder()
            .uri("/api/__panic")
            .body(Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(resp.headers().get("cache-control").unwrap(), "no-store");
        assert_eq!(resp.headers().get("x-frame-options").unwrap(), "DENY");
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["code"], "internal");
        assert_eq!(body["error"], "Terjadi kesalahan pada server.");

        let next = Request::builder()
            .uri("/healthz")
            .body(Body::empty())
            .unwrap();
        assert_eq!(app.oneshot(next).await.unwrap().status(), StatusCode::OK);
    }
}

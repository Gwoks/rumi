//! RBAC extractors (PRD §5.3.1): `CurrentUser` → 401 without a valid session;
//! `ParentUser` / `AdminUser` → 403 on the wrong role; `OptionalUser` never
//! rejects for a missing session.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;

use crate::auth::session::{session_token, user_for_token};
use crate::error::ApiError;
use crate::models::user::{User, ROLE_ADMIN, ROLE_PARENT};
use crate::state::AppState;

async fn resolve(parts: &Parts, state: &AppState) -> Result<Option<User>, ApiError> {
    match session_token(&parts.headers) {
        Some(token) => Ok(user_for_token(&state.pool, &token).await?),
        None => Ok(None),
    }
}

/// Any signed-in user.
#[derive(Debug, Clone)]
pub struct CurrentUser(pub User);

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        resolve(parts, state)
            .await?
            .map(CurrentUser)
            .ok_or_else(ApiError::unauthorized)
    }
}

/// The signed-in user, or `None`.
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<User>);

impl FromRequestParts<AppState> for OptionalUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        Ok(OptionalUser(resolve(parts, state).await?))
    }
}

async fn with_role(parts: &mut Parts, state: &AppState, role: &str) -> Result<User, ApiError> {
    let CurrentUser(user) = CurrentUser::from_request_parts(parts, state).await?;
    if user.role == role {
        Ok(user)
    } else {
        Err(ApiError::forbidden())
    }
}

/// A signed-in `PARENT`.
#[derive(Debug, Clone)]
pub struct ParentUser(pub User);

impl FromRequestParts<AppState> for ParentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        with_role(parts, state, ROLE_PARENT).await.map(ParentUser)
    }
}

/// A signed-in `ADMIN`.
#[derive(Debug, Clone)]
pub struct AdminUser(pub User);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        with_role(parts, state, ROLE_ADMIN).await.map(AdminUser)
    }
}

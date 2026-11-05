# Auth testing (Emergent Google Auth)
- Create test user + session in mongo (db test_database): users {user_id,email,name,picture,created_at}, user_sessions {user_id, session_token, expires_at(+7d), created_at}.
- Also insert profiles/settings docs for that user_id (see /app/backend/seed.py DEFAULT_PROFILE / DEFAULT_SETTINGS) — normally created by POST /api/auth/session.
- Use cookie session_token (httpOnly, secure, SameSite=None) or header Authorization: Bearer <token>.
- Owner lock: first email to sign in via /api/auth/session is stored in app_config {key:"owner"}; other emails get 403.

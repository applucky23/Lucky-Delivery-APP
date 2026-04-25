import os
import logging
import requests
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
from jwt.algorithms import ECAlgorithm

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .services import get_or_create_user_from_payload

logger = logging.getLogger(__name__)

# Cache JWKS keys in memory to avoid fetching on every request
_JWKS_CACHE = {}


def _get_public_key(kid: str):
    """Fetch and cache Supabase JWKS public key by kid."""
    if kid in _JWKS_CACHE:
        return _JWKS_CACHE[kid]

    supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"

    try:
        resp = requests.get(jwks_url, timeout=5)
        resp.raise_for_status()
        jwks = resp.json()
    except Exception as e:
        logger.error(f'[Auth] Failed to fetch JWKS: {e}')
        return None

    for key_data in jwks.get('keys', []):
        key_kid = key_data.get('kid')
        public_key = ECAlgorithm.from_jwk(key_data)
        _JWKS_CACHE[key_kid] = public_key

    return _JWKS_CACHE.get(kid)


class SupabaseJWTAuthentication(BaseAuthentication):
    """
    Verifies Supabase JWT tokens.
    Supports both ES256 (new) and HS256 (legacy) Supabase projects.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ', 1)[1].strip()
        if not token:
            return None

        payload = self._decode(token)
        user, _ = get_or_create_user_from_payload(payload)

        if not user.is_active:
            raise AuthenticationFailed('User account is disabled.')

        return (user, token)

    def _decode(self, token):
        # Peek at the header to determine algorithm
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception:
            raise AuthenticationFailed('Invalid token format.')

        alg = unverified_header.get('alg', 'HS256')
        kid = unverified_header.get('kid')

        if alg == 'ES256':
            return self._decode_es256(token, kid)
        else:
            return self._decode_hs256(token)

    def _decode_es256(self, token, kid):
        """Verify ES256 token using Supabase JWKS public key."""
        public_key = _get_public_key(kid) if kid else None

        if public_key:
            try:
                return jwt.decode(
                    token,
                    public_key,
                    algorithms=['ES256'],
                    audience='authenticated',
                )
            except ExpiredSignatureError:
                raise AuthenticationFailed('Token has expired.')
            except InvalidTokenError as e:
                raise AuthenticationFailed(f'Invalid token: {e}')
        else:
            # JWKS fetch failed — fallback: verify issuer only
            logger.warning('[Auth] JWKS unavailable, falling back to issuer check only.')
            try:
                payload = jwt.decode(
                    token,
                    options={'verify_signature': False},
                    algorithms=['ES256'],
                    audience='authenticated',
                )
                supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
                if payload.get('iss') != f"{supabase_url}/auth/v1":
                    raise AuthenticationFailed('Token issuer mismatch.')
                return payload
            except AuthenticationFailed:
                raise
            except Exception as e:
                raise AuthenticationFailed(f'Invalid token: {e}')

    def _decode_hs256(self, token):
        """Verify HS256 token using SUPABASE_JWT_SECRET."""
        secret = os.getenv('SUPABASE_JWT_SECRET', '').strip()
        if not secret:
            raise AuthenticationFailed('SUPABASE_JWT_SECRET is not configured.')
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=['HS256'],
                audience='authenticated',
            )
        except ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired.')
        except InvalidTokenError as e:
            raise AuthenticationFailed(f'Invalid token: {e}')

    def authenticate_header(self, request):
        return 'Bearer'

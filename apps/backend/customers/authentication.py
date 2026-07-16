import os
import logging
import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
from jwt.algorithms import ECAlgorithm
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .services.user_sync import get_or_create_user_from_payload

logger = logging.getLogger(__name__)

# PyJWKClient caches keys internally — one instance per process
_jwks_client = None

def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        logger.info(f'[Auth] JWKS client initialised: {jwks_url}')
    return _jwks_client


class SupabaseJWTAuthentication(BaseAuthentication):

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
        try:
            header = jwt.get_unverified_header(token)
        except Exception:
            raise AuthenticationFailed('Invalid token format.')

        alg = header.get('alg', 'HS256')
        logger.info(f'[Auth] Token alg={alg} kid={header.get("kid")}')

        if alg == 'ES256':
            return self._decode_es256(token)
        else:
            return self._decode_hs256(token)

    def _decode_es256(self, token):
        """Verify ES256 token using PyJWKClient (PyJWT 2.x)."""
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['ES256'],
                audience='authenticated',
                leeway=60,  # tolerate up to 60s clock skew between server and Supabase
            )
            logger.info(f'[Auth] ES256 verified sub={payload.get("sub")} phone={payload.get("phone")}')
            return payload
        except ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired.')
        except InvalidTokenError as e:
            logger.error(f'[Auth] ES256 decode failed: {e}')
            raise AuthenticationFailed(f'Invalid token: {e}')
        except Exception as e:
            logger.error(f'[Auth] ES256 unexpected error: {e}')
            raise AuthenticationFailed(f'Authentication error: {e}')

    def _decode_hs256(self, token):
        """Verify HS256 token using SUPABASE_JWT_SECRET (raw string)."""
        secret_raw = os.getenv('SUPABASE_JWT_SECRET', '').strip()
        if not secret_raw:
            raise AuthenticationFailed('SUPABASE_JWT_SECRET is not configured.')
        try:
            payload = jwt.decode(
                token,
                secret_raw.encode('utf-8'),
                algorithms=['HS256'],
                options={'verify_aud': False},
            )
            logger.info(f'[Auth] HS256 verified sub={payload.get("sub")}')
            return payload
        except ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired.')
        except InvalidTokenError as e:
            logger.error(f'[Auth] HS256 decode failed: {e}')
            raise AuthenticationFailed(f'Invalid token: {e}')

    def authenticate_header(self, request):
        return 'Bearer'

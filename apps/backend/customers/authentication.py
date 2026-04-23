import os
import logging
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .services import get_or_create_user_from_payload

logger = logging.getLogger(__name__)


class SupabaseJWTAuthentication(BaseAuthentication):
    """
    Stateless JWT authentication using Supabase-issued tokens.
    Responsibilities:
      1. Extract Bearer token from Authorization header
      2. Verify and decode JWT using SUPABASE_JWT_SECRET
      3. Delegate user sync to services.py
      4. Return (user, token)
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

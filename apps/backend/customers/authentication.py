from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _


class SupabaseJWTAuthentication(BaseAuthentication):
    """
    Custom DRF authentication class for Supabase JWT tokens
    """
    
    def authenticate(self, request):
        """
        Authenticate the request and return a two-tuple of (user, token).
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION')
        
        if not auth_header:
            return None
            
        try:
            # Extract token from "Bearer <token>" format
            auth_parts = auth_header.split()
            
            if len(auth_parts) != 2 or auth_parts[0].lower() != 'bearer':
                return None
                
            token = auth_parts[1]
            
            # Use our custom backend to authenticate
            user = authenticate(request=request, supabase_token=token)
            
            if not user:
                raise AuthenticationFailed(_('Invalid token.'))
                
            if not user.is_active:
                raise AuthenticationFailed(_('User inactive or deleted.'))
                
            return (user, token)
            
        except (ValueError, IndexError):
            raise AuthenticationFailed(_('Invalid token header.'))
    
    def authenticate_header(self, request):
        """
        Return a string to be used as the value of the `WWW-Authenticate`
        header in a `401 Unauthenticated` response.
        """
        return 'Bearer'
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from supabase import create_client, Client
import os
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

User = get_user_model()


class SupabaseAuthBackend(BaseBackend):
    """
    Custom authentication backend for Supabase JWT tokens
    """
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        self.supabase_jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
        
    def authenticate(self, request, supabase_token=None, **kwargs):
        """
        Authenticate user using Supabase JWT token (phone/OTP based)
        """
        if not supabase_token:
            return None
            
        try:
            # Decode and verify the JWT token
            payload = jwt.decode(
                supabase_token, 
                self.supabase_jwt_secret, 
                algorithms=['HS256'],
                audience='authenticated'
            )
            
            # Extract user info from token
            supabase_uid = payload.get('sub')
            phone = payload.get('phone')
            email = payload.get('email')
            
            if not supabase_uid or not phone:
                return None
                
            # Get or create user based on phone number
            user, created = User.objects.get_or_create(
                phone_number=phone,
                defaults={
                    'supabase_uid': supabase_uid,
                    'username': f'user_{phone}',
                    'email': email or '',
                }
            )
            
            # Update supabase_uid if user exists but doesn't have it
            if not user.supabase_uid:
                user.supabase_uid = supabase_uid
                user.save()
            
            return user
            
        except (InvalidTokenError, ExpiredSignatureError, KeyError):
            return None
    
    def get_user(self, user_id):
        """
        Get user by ID
        """
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
    
    def verify_supabase_token(self, token):
        """
        Verify if Supabase token is valid
        """
        try:
            payload = jwt.decode(
                token, 
                self.supabase_jwt_secret, 
                algorithms=['HS256'],
                audience='authenticated'
            )
            return payload
        except (InvalidTokenError, ExpiredSignatureError):
            return None

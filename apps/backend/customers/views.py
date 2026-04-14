from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Customer, OTP
from .serializers import SendOTPSerializer, VerifyOTPSerializer


class SendOTPView(APIView):
    """
    POST /api/auth/send-otp/
    Body: { "phone": "+251911234567" }
    Returns OTP in response (dev only — replace with SMS in production)
    """
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone = serializer.validated_data['phone']

        # Invalidate any previous unused OTPs for this phone
        OTP.objects.filter(phone=phone, is_used=False).update(is_used=True)

        # Generate and save new OTP
        code = OTP.generate_code()
        OTP.objects.create(phone=phone, code=code)

        return Response({
            'message': 'OTP sent successfully.',
            'otp': code,          # DEV ONLY — remove in production
            'phone': phone,
        }, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Body: { "phone": "+251911234567", "code": "1234" }
    Returns JWT access + refresh tokens
    """
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone = serializer.validated_data['phone']
        code  = serializer.validated_data['code']

        # Find the latest unused OTP for this phone
        otp = OTP.objects.filter(phone=phone, code=code, is_used=False).last()

        if not otp:
            return Response({'error': 'Invalid OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        if otp.is_expired():
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark OTP as used
        otp.is_used = True
        otp.save()

        # Get or create customer
        customer, _ = Customer.objects.get_or_create(phone=phone)

        # Generate JWT tokens using customer id as identity
        refresh = RefreshToken()
        refresh['customer_id'] = customer.id
        refresh['phone'] = customer.phone

        return Response({
            'message': 'Login successful.',
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'customer': {
                'id':    customer.id,
                'phone': customer.phone,
                'name':  customer.name,
            }
        }, status=status.HTTP_200_OK)

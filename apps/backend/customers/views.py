from rest_framework.views import APIView
from rest_framework.response import Response

class TestAuthView(APIView):
    def get(self, request):
        return Response({
            "user": request.user.username,
            "phone": request.user.phone_number
        })

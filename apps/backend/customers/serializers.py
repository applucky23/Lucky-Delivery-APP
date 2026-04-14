from rest_framework import serializers


class SendOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code  = serializers.CharField(min_length=4, max_length=4)

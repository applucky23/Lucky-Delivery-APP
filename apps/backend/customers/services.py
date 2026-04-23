import logging
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


def get_or_create_user_from_payload(payload: dict):
    """
    Given a decoded Supabase JWT payload, find or create the Django user.
    Returns (user, created).
    """
    supabase_uid = payload.get('sub')
    phone        = payload.get('phone') or payload.get('phone_number', '')
    email        = payload.get('email', '')

    # 1. Match by supabase_uid (most reliable)
    try:
        user = User.objects.get(supabase_uid=supabase_uid)
        updated = False
        if phone and user.phone_number != phone:
            user.phone_number = phone
            updated = True
        if email and user.email != email:
            user.email = email
            updated = True
        if updated:
            user.save(update_fields=['phone_number', 'email'])
        return user, False
    except User.DoesNotExist:
        pass

    # 2. Match by phone number
    if phone:
        try:
            user = User.objects.get(phone_number=phone)
            if not user.supabase_uid:
                user.supabase_uid = supabase_uid
                user.save(update_fields=['supabase_uid'])
            return user, False
        except User.DoesNotExist:
            pass

    # 3. Create new user
    base = f'user_{phone or supabase_uid[:8]}'
    username, i = base, 1
    while User.objects.filter(username=username).exists():
        username = f'{base}_{i}'
        i += 1

    user = User.objects.create(
        supabase_uid=supabase_uid,
        phone_number=phone or f'uid_{supabase_uid[:12]}',
        email=email,
        username=username,
        role='USER',
    )
    logger.info(f'[UserSync] Created new user id={user.id} phone={user.phone_number}')
    return user, True

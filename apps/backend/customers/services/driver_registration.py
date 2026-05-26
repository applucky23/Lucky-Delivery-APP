import logging
from django.db import IntegrityError, transaction
from ..models import DriverProfile
from notifications.services.notify_service import notify_welcome_driver, notify_admin_new_driver

logger = logging.getLogger(__name__)


@transaction.atomic
def register_driver(user, data):
    """
    Create or update a driver profile for the given user.
    
    Args:
        user: The User object to register as a driver
        data: Validated data from DriverRegistrationSerializer
        
    Returns:
        tuple: (profile, created) where profile is the DriverProfile instance
               and created is a boolean indicating if it was newly created
    """
    # Set user role to DRIVER
    if user.role != 'DRIVER':
        user.role = 'DRIVER'
        if data.get('email'):
            user.email = data['email'].lower().strip()
        user.save(update_fields=['role', 'email'])

    # Create or update DriverProfile
    try:
        profile, created = DriverProfile.objects.get_or_create(
            user=user,
            defaults={
                'full_name':    data['full_name'],
                'area':         data['area'],
                'vehicle_type': data['vehicle_type'],
                'id_image':     data.get('id_image', ''),
                'face_image':   data.get('face_image', ''),
                'is_verified':  False,  # Admin must approve
            }
        )
        if not created:
            # Update existing profile
            profile.full_name    = data['full_name']
            profile.area         = data['area']
            profile.vehicle_type = data['vehicle_type']
            if data.get('id_image'):
                profile.id_image = data['id_image']
            if data.get('face_image'):
                profile.face_image = data['face_image']
            profile.save()
    except IntegrityError:
        profile = DriverProfile.objects.get(user=user)
        created = False

    logger.info(f'[Driver] {"Created" if created else "Updated"} profile for user id={user.id}')

    if created:
        notify_welcome_driver(user)
        notify_admin_new_driver(user)

    return profile, created

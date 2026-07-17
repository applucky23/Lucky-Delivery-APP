import math
from decimal import Decimal
from django.db import transaction
from ..models import Task, Rating, User


class RatingError(Exception):
    """Custom exception for rating-related errors"""
    pass


def validate_rating_request(request_user, task, rating_direction='customer_to_driver'):
    """
    Validate rating request based on direction.
    
    Args:
        request_user: User making the rating request
        task: Task being rated
        rating_direction: 'customer_to_driver' or 'driver_to_customer'
    
    Raises:
        RatingError: If validation fails
    """
    if rating_direction == 'driver_to_customer':
        # Driver can rate the customer on COMPLETED or CANCELLED tasks —
        # cancelled covers the case where the customer rejected the price
        # after the driver already showed up and did the work
        if task.status not in ('COMPLETED', 'CANCELLED'):
            raise RatingError('Can only rate on completed or cancelled tasks')
    elif task.status != 'COMPLETED':
        raise RatingError('Can only rate completed tasks')

    if rating_direction == 'customer_to_driver':
        if task.user != request_user:
            raise RatingError('Customers can only rate their own tasks')
        if not task.driver:
            raise RatingError('No driver assigned to this task')
        if Rating.objects.filter(from_user=request_user, task=task).exists():
            raise RatingError('You have already rated this task')
    
    elif rating_direction == 'driver_to_customer':
        if not task.driver or task.driver.user != request_user:
            raise RatingError('Only assigned drivers can rate the customer')
        if Rating.objects.filter(from_user=request_user, task=task).exists():
            raise RatingError('You have already rated this customer for this task')
    
    else:
        raise RatingError('Invalid rating direction')


def create_rating(request_user, task, rating_value, comment, rating_direction='customer_to_driver'):
    """
    Create a rating and update the recipient's rating stats.
    
    Args:
        request_user: User creating the rating
        task: Task being rated
        rating_value: Rating value (1-5)
        comment: Optional comment
        rating_direction: 'customer_to_driver' or 'driver_to_customer'
    
    Returns:
        Rating: The created rating object
    
    Raises:
        RatingError: If validation fails
    """
    validate_rating_request(request_user, task, rating_direction)
    
    with transaction.atomic():
        # Determine who is being rated
        if rating_direction == 'customer_to_driver':
            to_user = task.driver.user
        else:
            to_user = task.user
        
        # Create the rating
        rating = Rating.objects.create(
            from_user=request_user,
            to_user=to_user,
            task=task,
            rating=rating_value,
            comment=comment or '',
        )
        
        # Update recipient's rating stats using incremental arithmetic
        old_count = to_user.rating_count or 0
        old_avg = Decimal(str(to_user.rating or 0))
        new_count = old_count + 1
        to_user.rating = ((old_avg * old_count) + Decimal(rating_value)) / new_count
        to_user.rating_count = new_count
        to_user.save(update_fields=['rating', 'rating_count'])
        
        return rating


def get_user_rating(user_id):
    """
    Get a user's rating summary.
    
    Args:
        user_id: User ID to get rating for
    
    Returns:
        dict: Rating summary with average, count, and recent reviews
    """
    from django.db.models import Avg, Count
    
    user = User.objects.get(id=user_id)
    ratings = Rating.objects.filter(to_user=user)
    agg = ratings.aggregate(avg=Avg('rating'), count=Count('id'))
    recent = ratings.select_related('from_user').order_by('-created_at')[:5]
    
    avg_val = float(agg['avg']) if agg['avg'] else 0.0
    return {
        'average_rating': avg_val if not math.isnan(avg_val) else 0.0,
        'rating_count': agg['count'],
        'recent_reviews': [
            {
                'rating': r.rating,
                'comment': r.comment,
                'from_user_name': r.from_user.profile.name if hasattr(r.from_user, 'profile') and r.from_user.profile.name else r.from_user.username,
                'created_at': r.created_at,
            }
            for r in recent
        ],
    }


def check_already_rated(request_user, task_id):
    """
    Check if user has already rated a specific task.
    
    Args:
        request_user: User to check
        task_id: Task ID to check
    
    Returns:
        Rating or None: Rating if exists, None otherwise
    """
    try:
        return Rating.objects.get(from_user=request_user, task_id=task_id)
    except Rating.DoesNotExist:
        return None

from django.urls import path
from .views import (
    ReviewAnalyzeAPIView,
    ReviewAnalyzeTaskStatusAPIView,
)

urlpatterns = [
    path(
        "reviews/<int:review_id>/analyze/",
        ReviewAnalyzeAPIView.as_view(),
        name="ai-review-analyze",
    ),
    path(
        "tasks/<str:task_id>/status/",
        ReviewAnalyzeTaskStatusAPIView.as_view(),
        name="ai-task-status",
    ),
]

from django.urls import path
from . import views
# ======================================================================================================================
app_name = "calls"
# ======================================================================================================================
urlpatterns = [
    path("calls/", views.CallLogListCreateView.as_view(), name="call-log-list-create"),
    path("calls/<int:pk>/", views.CallLogDetailView.as_view(), name="call-log-detail"),
    path("group-calls/", views.GroupCallLogListCreateView.as_view(), name="group-call-log-list-create"),
    path("group-calls/<int:pk>/", views.GroupCallLogDetailView.as_view(), name="group-call-log-detail"),
]
# ======================================================================================================================
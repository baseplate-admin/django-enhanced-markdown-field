import logging

from django import forms
from .widget import MarkdownFormWidget

logger = logging.getLogger("django_markdown_field")


class MarkdownFormField(forms.CharField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MarkdownFormWidget)
        super().__init__(*args, **kwargs)

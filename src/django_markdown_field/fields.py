from django.db import models
from .forms import MarkdownFormField
from .widget import MarkdownFormWidget


class MarkdownField(models.TextField):
    def formfield(self, **kwargs):
        defaults = kwargs.copy()
        defaults = {
            "form_class": MarkdownFormField,
            "widget": MarkdownFormWidget,
        }
        return super().formfield(**defaults)

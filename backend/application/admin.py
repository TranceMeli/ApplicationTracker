from django.contrib import admin

from .models import Application, ApplicationEvent, Attachment


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    readonly_fields = ("uploaded_at",)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "company", "position", "city", "status", "is_favorite")
    list_filter = ("status", "is_favorite", "work_mode", "channel")
    search_fields = ("company", "position", "contact_person", "city")
    inlines = [AttachmentInline]
    readonly_fields = ("deleted_at",)


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kind", "application", "uploaded_at")
    list_filter = ("kind",)


@admin.register(ApplicationEvent)
class ApplicationEventAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "kind", "status", "date")
    list_filter = ("kind",)

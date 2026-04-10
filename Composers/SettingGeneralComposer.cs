using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

public class SettingGeneralComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddSingleton<GeneralSiteSettingsService>();
        builder.Sections().Append<SettingGeneralSection>();
        builder.AddNotificationHandler<UmbracoApplicationStartedNotification, SettingGeneralAdminSectionHandler>();
    }
}

using Microsoft.Extensions.DependencyInjection;
using umb_projectv13;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using umb_projectv13.Notifications;

public class SettingGeneralComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.Configure<TinifyMediaOptions>(builder.Config.GetSection(TinifyMediaOptions.SectionName));
        builder.Services.AddSingleton<GeneralSiteSettingsService>();
        builder.Sections().Append<SettingGeneralSection>();
        builder.AddNotificationHandler<UmbracoApplicationStartedNotification, SettingGeneralAdminSectionHandler>();
        builder.AddNotificationAsyncHandler<MediaSavedNotification, TinifyMediaSavedHandler>();
    }
}

using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;

public class SettingGeneralAdminSectionHandler : INotificationHandler<UmbracoApplicationStartedNotification>
{
    private const string SectionAlias = "settingGeneral";
    private readonly IUserService _userService;

    public SettingGeneralAdminSectionHandler(IUserService userService) => _userService = userService;

    public void Handle(UmbracoApplicationStartedNotification notification)
    {
        IUserGroup? admin = _userService.GetUserGroupByAlias(Constants.Security.AdminGroupAlias);
        if (admin is not UserGroup group) return;
        if (group.AllowedSections.InvariantContains(SectionAlias)) return;
        group.AddAllowedSection(SectionAlias);
        _userService.Save(group);
    }
}

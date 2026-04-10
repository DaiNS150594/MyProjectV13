using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models.Trees;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Trees;
using Umbraco.Cms.Web.BackOffice.Trees;
using Umbraco.Cms.Web.Common.Attributes;

[Tree(
    "settingGeneral",
    "generalSettings",
    IsSingleNodeTree = true,
    TreeTitle = "Setting General",
    TreeGroup = Constants.Trees.Groups.Settings,
    SortOrder = 99)]
[PluginController("SettingGeneral")]
public class SettingGeneralTreeController : TreeController
{
    private readonly IMenuItemCollectionFactory _menuItemCollectionFactory;

    public SettingGeneralTreeController(
        ILocalizedTextService localizedTextService,
        UmbracoApiControllerTypeCollection umbracoApiControllerTypeCollection,
        IMenuItemCollectionFactory menuItemCollectionFactory,
        IEventAggregator eventAggregator)
        : base(localizedTextService, umbracoApiControllerTypeCollection, eventAggregator) =>
        _menuItemCollectionFactory = menuItemCollectionFactory;

    protected override ActionResult<TreeNodeCollection> GetTreeNodes(string id, FormCollection queryStrings) =>
        new TreeNodeCollection();

    protected override ActionResult<MenuItemCollection> GetMenuForNode(string id, FormCollection queryStrings) =>
        _menuItemCollectionFactory.Create();

    protected override ActionResult<TreeNode?> CreateRootNode(FormCollection queryStrings)
    {
        var rootResult = base.CreateRootNode(queryStrings);
        if (rootResult.Result is not null)
            return rootResult;

        var root = rootResult.Value;
        if (root is null)
            return rootResult;

        root.RoutePath = $"{SectionAlias}/{TreeAlias}/overview";
        root.Icon = "icon-settings";
        root.HasChildren = false;
        root.MenuUrl = null;

        return root;
    }
}

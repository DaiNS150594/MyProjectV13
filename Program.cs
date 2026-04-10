using Umbraco.Cms.Core.Notifications;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddWebOptimizer(pipeline =>
{
    pipeline.AddJavaScriptBundle("/bundles/inline-js-bundle", new[]
    {
        "/scripts/lib/jquery.min.js",
        "/scripts/custom/site-user.js",
        "/scripts/lib/aos.js",
        "/scripts/lib/headroom.js",
        "/scripts/lib/magnific-popup.js",
        "/scripts/lib/jquery.nice-select.min.js",
        "/scripts/lib/lazysizes.min.js",
        "/scripts/lib/swiper-bundle.min.js",
        "/scripts/lib/text-animate.js",
        "/scripts/common/*",
        "/scripts/pages/*",
    });

    pipeline.MinifyCssFiles();
    pipeline.MinifyJsFiles();
});

builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
    // .AddNotificationHandler<UmbracoApplicationStartedNotification, UserSeederHandler>()
    // .AddNotificationHandler<UmbracoApplicationStartedNotification, DictionarySeederHandler>()
    // .AddNotificationHandler<UmbracoApplicationStartedNotification, MediaFolderSeederHandler>()
    .Build();

WebApplication app = builder.Build();

await app.BootUmbracoAsync();

app.MapGet("/bundles/inline-css-bundle.css", async (HttpContext ctx, IWebHostEnvironment env, GeneralSiteSettingsService settingsSvc) =>
{
    ctx.Response.ContentType = "text/css; charset=utf-8";
    ctx.Response.Headers.CacheControl = "no-cache";

    var s = settingsSvc.Get();
    var body = await InlineCssBundleBuilder.BuildAsync(env, s, ctx.RequestAborted).ConfigureAwait(false);
    return Results.Text(body, "text/css; charset=utf-8");
});

app.UseWebOptimizer();
app.UseStaticFiles();

app.UseUmbraco()
    .WithMiddleware(u =>
    {
        u.UseBackOffice();
        u.UseWebsite();
    })
    .WithEndpoints(u =>
    {
        u.UseBackOfficeEndpoints();
        u.UseWebsiteEndpoints();
    });

await app.RunAsync();
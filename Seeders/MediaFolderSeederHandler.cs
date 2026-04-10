using System.Text.Json;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using File = System.IO.File;

public class MediaFolderSeederHandler : INotificationHandler<UmbracoApplicationStartedNotification>
{
    private readonly IWebHostEnvironment _env;
    private readonly IMediaService _mediaService;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MediaFolderSeederHandler(IWebHostEnvironment env, IMediaService mediaService)
    {
        _env = env;
        _mediaService = mediaService;
    }

    public void Handle(UmbracoApplicationStartedNotification notification)
        => HandleAsync(notification).GetAwaiter().GetResult();

    private async Task HandleAsync(UmbracoApplicationStartedNotification notification)
    {
        var path = Path.Combine(_env.ContentRootPath, "Config", "media-folders.json");
        if (!File.Exists(path)) return;

        MediaFolderSeedConfig? config;
        try
        {
            var json = await File.ReadAllTextAsync(path);
            config = JsonSerializer.Deserialize<MediaFolderSeedConfig>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Seed media-folders.json deserialize failed: {ex.Message}");
            return;
        }

        if (config is null || config.Items.Count == 0) return;

        SeedFolders(config.Items);
    }

    private void SeedFolders(IEnumerable<MediaFolderItemConfig> items)
    {
        var created = 0;
        var skipped = 0;
        var failed = 0;

        var rootNames = _mediaService
            .GetRootMedia()
            .Select(m => m.Name ?? string.Empty)
            .Where(n => n.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Name))
            {
                skipped++;
                continue;
            }

            var name = item.Name.Trim();
            if (rootNames.Contains(name))
            {
                skipped++;
                continue;
            }

            try
            {
                IMedia folder = _mediaService.CreateMedia(
                    name,
                    Constants.System.Root,
                    Constants.Conventions.MediaTypes.Folder);

                var result = _mediaService.Save(folder);
                if (!result.Success)
                {
                    Console.WriteLine($"⚠️ Seed media folder save failed: {name} - {result.Result}");
                    failed++;
                    continue;
                }

                rootNames.Add(name);
                created++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Seed media folder failed: {name} - {ex.Message}");
                failed++;
            }
        }

        Console.WriteLine($"ℹ️ Seed media folders done. Created={created}, Skipped={skipped}, Failed={failed}");
    }
}

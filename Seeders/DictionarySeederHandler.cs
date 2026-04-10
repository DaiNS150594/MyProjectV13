using System.Text.Json;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using File = System.IO.File;

public class DictionarySeederHandler : INotificationHandler<UmbracoApplicationStartedNotification>
{
    private readonly IWebHostEnvironment _env;
    private readonly ILocalizationService _localizationService;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public DictionarySeederHandler(IWebHostEnvironment env, ILocalizationService localizationService)
    {
        _env = env;
        _localizationService = localizationService;
    }

    public void Handle(UmbracoApplicationStartedNotification notification)
        => HandleAsync(notification).GetAwaiter().GetResult();

    private async Task HandleAsync(UmbracoApplicationStartedNotification notification)
    {
        var path = Path.Combine(_env.ContentRootPath, "Config", "dictionary.json");
        if (!File.Exists(path)) return;

        DictionarySeedConfig? config;
        try
        {
            var json = await File.ReadAllTextAsync(path);
            config = JsonSerializer.Deserialize<DictionarySeedConfig>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Seed dictionary.json deserialize failed: {ex.Message}");
            return;
        }

        if (config is null || config.Items.Count == 0) return;

        SeedDictionaryItems(config.Items);
    }

    private void SeedDictionaryItems(IEnumerable<DictionaryItemConfig> items)
    {
        var created = 0;
        var updated = 0;
        var skipped = 0;
        var failed = 0;

        foreach (var itemConfig in items)
        {
            if (string.IsNullOrWhiteSpace(itemConfig.Key))
            {
                skipped++;
                continue;
            }

            var existedBefore = false;
            Umbraco.Cms.Core.Models.IDictionaryItem? item;
            try
            {
                existedBefore = _localizationService.DictionaryItemExists(itemConfig.Key);
                item = existedBefore
                    ? _localizationService.GetDictionaryItemByKey(itemConfig.Key)
                    : _localizationService.CreateDictionaryItemWithIdentity(itemConfig.Key, parentId: null);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Seed dictionary item failed (get/create): {itemConfig.Key} - {ex.Message}");
                failed++;
                continue;
            }

            if (item is null)
            {
                failed++;
                continue;
            }

            var anyChange = false;
            foreach (var kv in itemConfig.Translations)
            {
                var iso = kv.Key?.Trim();
                var value = kv.Value;

                if (string.IsNullOrWhiteSpace(iso)) continue;

                var language = _localizationService.GetLanguageByIsoCode(iso);
                if (language is null)
                {
                    Console.WriteLine($"⚠️ Seed dictionary translation skipped (language missing): {itemConfig.Key} -> {iso}");
                    continue;
                }

                try
                {
                    _localizationService.AddOrUpdateDictionaryValue(item, language, value ?? string.Empty);
                    anyChange = true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ Seed dictionary translation failed: {itemConfig.Key} -> {iso} - {ex.Message}");
                }
            }

            if (!anyChange)
            {
                skipped++;
                continue;
            }

            try
            {
                _localizationService.Save(item);

                if (existedBefore)
                {
                    updated++;
                }
                else
                {
                    created++;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Seed dictionary item save failed: {itemConfig.Key} - {ex.Message}");
                failed++;
            }
        }

        Console.WriteLine($"ℹ️ Seed dictionary done. Created={created}, Updated={updated}, Skipped={skipped}, Failed={failed}");
    }
}


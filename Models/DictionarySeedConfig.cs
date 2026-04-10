public class DictionarySeedConfig
{
    public List<DictionaryItemConfig> Items { get; set; } = new();
}

public class DictionaryItemConfig
{
    public string Key { get; set; } = "";
    public Dictionary<string, string> Translations { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}


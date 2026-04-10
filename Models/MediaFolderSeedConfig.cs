public class MediaFolderSeedConfig
{
    public List<MediaFolderItemConfig> Items { get; set; } = new();
}

public class MediaFolderItemConfig
{
    public string Name { get; set; } = "";
}

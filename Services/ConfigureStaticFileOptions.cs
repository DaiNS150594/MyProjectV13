using Microsoft.AspNetCore.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Umbraco.Cms.Core.Configuration.Models;
using IHostingEnvironment = Umbraco.Cms.Core.Hosting.IHostingEnvironment;

namespace umb_projectv13.Services
{
    public class ConfigureStaticFileOptions : IConfigureOptions<StaticFileOptions>
    {
        // These are the extensions of the file types we want to cache (add and remove as you see fit)
        private static readonly HashSet<string> _cachedFileExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".ico",".webp",".svg",".jpg","jpeg",".gif",".png",
            ".css",
            ".js",            
            ".woff",".woff2",".ttf",".otf",".eof",            
            ".mp4",".mp3",
            ".pdf"
        };

        private readonly string _backOfficePath;

        public ConfigureStaticFileOptions(IOptions<GlobalSettings> globalSettings, IHostingEnvironment hostingEnvironment)
            => _backOfficePath = globalSettings.Value.GetBackOfficePath(hostingEnvironment);

        public void Configure(StaticFileOptions options)
            => options.OnPrepareResponse = ctx =>
            {
                // Exclude Umbraco backoffice assets
                if (ctx.Context.Request.Path.StartsWithSegments(_backOfficePath))
                {
                    return;
                }

                // Exclude Umbraco plugin assets (App_Plugins) to avoid "sticky" backoffice caching
                // which prevents CSS/JS changes from showing up during development/iteration.
                if (ctx.Context.Request.Path.StartsWithSegments(new PathString("/App_Plugins")))
                {
                    return;
                }

                // Set headers for specific file extensions
                var fileExtension = Path.GetExtension(ctx.File.Name);
                if (_cachedFileExtensions.Contains(fileExtension))
                {
                    ResponseHeaders headers = ctx.Context.Response.GetTypedHeaders();

                    // Update or set Cache-Control header
                    CacheControlHeaderValue cacheControl = headers.CacheControl ?? new CacheControlHeaderValue();
                    cacheControl.Public = true;
                    cacheControl.MaxAge = TimeSpan.FromDays(365);
                    headers.CacheControl = cacheControl;
                }
            };
    }
}

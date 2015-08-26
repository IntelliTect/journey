using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(Journey.Startup))]
namespace Journey
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}

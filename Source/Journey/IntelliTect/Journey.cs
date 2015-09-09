using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Newtonsoft.Json;

namespace IntelliTect
{
    public class Journey
    {
        public static ActionResult Close(bool refresh = true)
        {
            return new ContentResult()
            {
                Content = "Journey Page Close" + (refresh ? ": Refresh": "")
            };
        }
        public static ActionResult RefreshPage()
        {
            return new ContentResult()
            {
                Content = "Journey Refresh Page"
            };
        }
        public static ActionResult RefreshAll()
        {
            return new ContentResult()
            {
                Content = "Journey Refresh All"
            };
        }


    }
}
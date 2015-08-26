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
        public static ActionResult Close
        {
            get
            {
                return new ContentResult()
                {
                    Content = "Journey Page Close"
                };
            }
        }
        public static ActionResult RefreshPage
        {
            get
            {
                return new ContentResult()
                {
                    Content = "Journey Refresh Page"
                };
            }
        }
        public static ActionResult RefreshAll
        {
            get
            {
                return new ContentResult()
                {
                    Content = "Journey Refresh All"
                };
            }
        }


    }
}
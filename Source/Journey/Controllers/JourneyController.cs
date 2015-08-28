using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace Journey.Controllers
{
    public class JourneyController : Controller
    {
        // GET: Journey
        public ActionResult Index()
        {
            ViewBag.Title = "Journey";
            return View();
        }

        public ActionResult Home()
        {
            return View();
        }

        public ActionResult Admin()
        {
            return View();
        }

        public ActionResult UserInfo()
        {
            return View();
        }

        public ActionResult Docs()
        {
            return View();
        }

        public ActionResult Logs()
        {
            return View();
        }
        public ActionResult Content()
        {
            return View();
        }
        public ActionResult JsRefresh()
        {
            return View();
        }
    }
}
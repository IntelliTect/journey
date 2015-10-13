using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace Journey.Controllers
{
    public class JourneyController : Controller
    {
        public static string _name = "Bond, James Bond";

        // GET: Journey
        public ActionResult Index(string width = "")
        {
            ViewBag.Title = "Journey";
            if (string.IsNullOrEmpty(width)) ViewBag.Width = width;
            else ViewBag.Width = "." + width;
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

        public ActionResult Logs(string index = "")
        {
            ViewBag.Index = index;
            return View();
        }
        public ActionResult Content()
        {
            return View();
        }

        public ActionResult ShowEditorValues(bool openPageAfterSubmit = false)
        {
            var data = new EditorModel()
            {
                Name = _name
            };
            ViewBag.OpenPageAfterSubmit = openPageAfterSubmit;

            return View(data);
        }
        public ActionResult JsRefresh()
        {
            return View();
        }

        [HttpGet]
        public ActionResult Editor()
        {
            var data = new EditorModel()
            {
                Name = _name
            };
            return View(data);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Editor(EditorModel data, bool NewPage = false)
        {
            if (string.IsNullOrWhiteSpace(data.Name))
            {
                // Push back an error
                ModelState.AddModelError("Name", "Name must be specified");
                return View(data);
            }
            else
            {
                _name = data.Name;

                if (NewPage)
                {
                    return RedirectToAction("ShowEditorValues");
                }
                else
                {
                    // Close the page
                    return IntelliTect.Journey.Close(data.Refresh);
                }
            }
        }

        [HttpGet]
        public ActionResult HomeWithPost()
        {
            var data = new HomeModel()
            {
                Name = _name
            };
            return View(data);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult HomeWithPost(HomeModel data, bool NewPage = false)
        {
            if (string.IsNullOrWhiteSpace(data.Name))
            {
                // Push back an error
                ModelState.AddModelError("Name", "Name must be specified");
                return View(data);
            }
            else
            {
                _name = data.Name;

                if (NewPage)
                {
                    return RedirectToAction("ShowEditorValues");
                }
                else
                {
                    // Refresh the home page
                    return IntelliTect.Journey.RefreshPage();
                }
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult HomeWithPostNewPage(HomeModel data)
        {
            if (string.IsNullOrWhiteSpace(data.Name))
            {
                // Push back an error
                ModelState.AddModelError("Name", "Name must be specified");
                return View(data);
            }
            else
            {
                _name = data.Name;

                return RedirectToAction("ShowEditorValues");
            }
        }

    }


    public class EditorModel
    {
        public string Name { get; set; }
        public bool Refresh { get; set; }
    }

    public class HomeModel
    {
        public string Name { get; set; }
    }

}
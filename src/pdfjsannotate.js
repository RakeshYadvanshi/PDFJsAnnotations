/**
 * PDFAnnotate v2.0.0
 * Author: Ravisha Heshan
 */

const pdfjsLib = require("pdfjs-dist/legacy/build/pdf");
const fabric = require("fabric").fabric;
require("./arrow.fabric.js");
const $ = require("jquery")
const jsPDF = require("jspdf");
(typeof window !== "undefined"
  ? window
  : {}
).pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker");
const SVG_NS = "http://www.w3.org/2000/svg";

// Event List
const PDFAnnotate = (window.PDFAnnotate = function (container_id, url, options) {
  this.number_of_pages = 0;
  this.pages_rendered = 0;
  this.active_tool = 1; // 1 - Free hand, 2 - Text, 3 - Arrow
  this.fabricObjects = [];
  this.fabricObjectsData = [];
  this.textContents = []; // extra
  this.color = "#212121";
  this.borderColor = '#000000';
  this.borderSize = 1;
  this.font_size = 16;
  this.active_canvas = 0;
  this.container_id = container_id;
  this.url = url;
  this.options = options
  this.format;
  this.orientation;
  const inst = this;

  this.options.error = this.options.error || ((reason) => { console.error(reason) });
  this.options.mouseUp = this.options.mouseUp || ((e) => { });
  this.options.mouseHover = this.options.mouseHover || ((e) => { });
  this.options.mouseOut = this.options.mouseOut || ((e) => { });
  const loadingTask = pdfjsLib.getDocument(this.url);
  loadingTask.promise.then(
    async function (pdf) {
      var scale = 1.3;
      inst.number_of_pages = pdf._pdfInfo.numPages;
      for (var i = 1; i <= inst.number_of_pages; i++) {
        let page = await pdf.getPage(i);
        if (typeof inst.format === 'undefined' ||
          typeof inst.orientation === 'undefined') {
          var originalViewport = page.getViewport({ scale: 1 });
          inst.format = [originalViewport.width, originalViewport.height];
          inst.orientation =
            originalViewport.width > originalViewport.height ?
              'landscape' :
              'portrait';
        }

        var viewport = page.getViewport({ scale });
        var imageCanvas = document.createElement("canvas");
        document
          .getElementById(inst.container_id)
          .appendChild(imageCanvas);
        imageCanvas.className = "pdf-image-canvas";
        imageCanvas.height = viewport.height;
        imageCanvas.width = viewport.width;
        imageCanvasContext = imageCanvas.getContext("2d");

       await page.render({ canvasContext: imageCanvasContext, viewport: viewport,}).promise;

        inst.pages_rendered++;

        if (inst.pages_rendered == inst.number_of_pages) {
          $(".pdf-image-canvas").each(function (index, el) {
            var imageCanvasElement = el;
            imageCanvasElement.id = `page-${index + 1}-image-canvas`;
          });
          inst.initFabric();
        }
      }

    },
    function (reason) {
      options.error(reason);
    }
  );

  this.initFabric = function () {
    var inst = this;
    let canvases = $('#' + inst.container_id + ' canvas');
    canvases.each(function (index, el) {
      var background = el.toDataURL('image/png');
      var fabricObj = new fabric.Canvas(el.id, {
        freeDrawingBrush: {
          width: 1,
          color: inst.color,
          allowTouchScrolling: true,
        },
      });

      inst.fabricObjects.push(fabricObj);

      if (typeof options.onPageUpdated == 'function') {
        fabricObj.on('object:added', function () {
          var oldValue = Object.assign({}, inst.fabricObjectsData[index]);
          inst.fabricObjectsData[index] = fabricObj.toJSON();
          options.onPageUpdated(
            index + 1,
            oldValue,
            inst.fabricObjectsData[index]
          );
        });
      }
      fabricObj.setBackgroundImage(
        background,
        fabricObj.renderAll.bind(fabricObj)
      );
      $(fabricObj.upperCanvasEl).click(function (event) {
        inst.active_canvas = index;
        inst.fabricClickHandler(event, fabricObj);
      });
      fabricObj.on('after:render', function () {
        inst.fabricObjectsData[index] = fabricObj.toJSON();
        fabricObj.off('after:render');
      });
      fabricObj.on('mouse:up', options.mouseUp);
      fabricObj.on('mouse:over', options.mouseHover);
      fabricObj.on('mouse:out', options.mouseOut);
      if (index === canvases.length - 1 && typeof options.ready === 'function') {
        options.ready();
      }
    });
  };



  this.fabricClickHandler = function (event, fabricObj) {
    var inst = this;
    if (inst.active_tool == 2) {
      inst.drawText({
        left:
          event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
        top:
          event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
        fill: inst.color,
        fontSize: inst.font_size,
        selectable: true,
      });
      inst.active_tool = 0;
    }
    else if (inst.active_tool == 4) {
      inst.drawRectangle({
        left: event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
        top: event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
        width: 100,
        height: 100,
        fill: inst.color,
        stroke: inst.borderColor,
        strokeSize: inst.borderSize,
      });
    }
  };
});


PDFAnnotate.prototype.drawRectangle = function (opts, canvas_index = -1) {
  let inst = this;
  let rectagle = new fabric.Rect(opts);
  if (canvas_index == -1) {
    canvas_index = inst.active_canvas
  }
  if (rectagle) {
    inst.fabricObjects[canvas_index].add(rectagle);
  }
  return rectagle;

}


PDFAnnotate.prototype.addImage = function (opts, image, canvas_index = -1) {
  let inst = this;
  let fimage = new fabric.Image(image, opts);
  if (canvas_index == -1) {
    canvas_index = inst.active_canvas
  }
  if (fimage) {
    inst.fabricObjects[canvas_index].add(fimage);
  }
  return fimage;

}


PDFAnnotate.prototype.drawText = function (opts, input_text = "Sample text", canvas_index = -1) {
  let inst = this;
  let text = new fabric.IText(input_text, opts);
  if (canvas_index == -1) {
    canvas_index = inst.active_canvas
  }
  if (text) {
    inst.fabricObjects[canvas_index].add(text);
  }
  return text;
}

PDFAnnotate.prototype.drawPolygon = function (points, opts, canvas_index = -1) {
  let inst = this;
  let plygn = new fabric.Polygon(points, opts);
  if (canvas_index == -1) {
    canvas_index = inst.active_canvas
  }
  if (plygn) {
    inst.fabricObjects[canvas_index].add(plygn);
  }
  return plygn;
}
PDFAnnotate.prototype.enablePencil = function () {
  var inst = this;
  inst.active_tool = 1;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = true;
    });
  }
};

PDFAnnotate.prototype.enableSelector = function () {
  var inst = this;
  inst.active_tool = 0;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }
};

PDFAnnotate.prototype.savePdf = function (fileName) {
  if (typeof fileName == "undefined" || fileName.length == 0)
    fileName = "sample.pdf";

  var inst = this;
  inst.save("save", { fileName })
}
PDFAnnotate.prototype.save = function (type, options) {
  var inst = this;
  var doc = new jsPDF();
  $.each(inst.fabricObjects, function (index, fabricObj) {
    fabricObj.backgroundImage = false;
    if (index != 0) {
      doc.addPage();
      doc.setPage(index + 1);
    }
    doc.addImage(
      document.getElementById(fabricObj.lowerCanvasEl.id).toDataURL(),
      "png",
      0,
      0
    );
    doc.addImage(fabricObj.toDataURL(), "png", 0, 0);
  });
  return doc.output(type, options);
};

PDFAnnotate.prototype.enableAddText = function (text) {
  var inst = this;
  inst.active_tool = 2;
  if (typeof text === 'string') {
    inst.textBoxText = text;
  }
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }
};

PDFAnnotate.prototype.enableRectangle = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];
  inst.active_tool = 4;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
    });
  }
};
PDFAnnotate.prototype.getObjects = function (canvas_index = -1) {
  let inst = this;
  if (canvas_index == -1) {
    canvas_index = inst.active_canvas
  };
  return inst.fabricObjects[canvas_index].getObjects();
}
PDFAnnotate.prototype.enableAddArrow = function (onDrawnCallback = null) {
  var inst = this;
  inst.active_tool = 3;
  if (inst.fabricObjects.length > 0) {
    $.each(inst.fabricObjects, function (index, fabricObj) {
      fabricObj.isDrawingMode = false;
      new Arrow(fabricObj, inst.color, function () {
        inst.active_tool = 0;
        if (typeof onDrawnCallback === 'function') {
          onDrawnCallback();
        }
      });
    });
  }
};

PDFAnnotate.prototype.addImageToCanvas = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];

  if (fabricObj) {
    var inputElement = document.createElement('input');
    inputElement.type = 'file';
    inputElement.accept = '.jpg,.jpeg,.png,.PNG,.JPG,.JPEG';
    inputElement.onchange = function () {
      var reader = new FileReader();
      reader.addEventListener(
        'load',
        function () {
          inputElement.remove();
          var image = new Image();
          image.onload = function () {
            fabricObj.add(new fabric.Image(image));
          };
          image.src = this.result;
        },
        false
      );
      reader.readAsDataURL(inputElement.files[0]);
    };
    document.getElementsByTagName('body')[0].appendChild(inputElement);
    inputElement.click();
  }
};

PDFAnnotate.prototype.deleteSelectedObject = function () {
  var inst = this;
  var activeObject = inst.fabricObjects[inst.active_canvas].getActiveObject();
  if (activeObject) {
    if (confirm('Are you sure delete selected object ?')) {
      inst.deleteObject(inst.active_canvas, activeObject)
    }
  }
};

PDFAnnotate.prototype.deleteObject = function (canvas_index, obj) {
  var inst = this;
  inst.fabricObjects[canvas_index].remove(obj);
};
PDFAnnotate.prototype.setBrushSize = function (size) {
  var inst = this;
  $.each(inst.fabricObjects, function (index, fabricObj) {
    fabricObj.freeDrawingBrush.width = parseInt(size, 10) || 1;
  });
};

PDFAnnotate.prototype.setColor = function (color) {
  var inst = this;
  inst.color = color;
  $.each(inst.fabricObjects, function (index, fabricObj) {
    fabricObj.freeDrawingBrush.color = color;
  });
};

PDFAnnotate.prototype.setBorderColor = function (color) {
  var inst = this;
  inst.borderColor = color;
};

PDFAnnotate.prototype.setFontSize = function (size) {
  this.font_size = size;
};

PDFAnnotate.prototype.setBorderSize = function (size) {
  this.borderSize = size;
};

PDFAnnotate.prototype.getActivePageIndex = function () {
  return this.active_canvas;
};

PDFAnnotate.prototype.clearActivePage = function () {
  var inst = this;
  var fabricObj = inst.fabricObjects[inst.active_canvas];
  var bg = fabricObj.backgroundImage;
  if (confirm('Are you sure clear current page?')) {
    fabricObj.clear();
    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
  }
};

PDFAnnotate.prototype.serializePdf = function (callback) {
  var inst = this;
  var pageAnnotations = [];
  inst.fabricObjects.forEach(function (fabricObject) {
    fabricObject.clone(function (fabricObjectCopy) {
      fabricObjectCopy.setBackgroundImage(null);
      fabricObjectCopy.setBackgroundColor('');
      pageAnnotations.push(fabricObjectCopy);
      if (pageAnnotations.length === inst.fabricObjects.length) {
        var data = {
          page_setup: {
            format: inst.format,
            orientation: inst.orientation,
          },
          pages: pageAnnotations,
        };
        callback(JSON.stringify(data));
      }
    });
  });
};

PDFAnnotate.prototype.loadFromJSON = function (jsonData) {
  var inst = this;
  var { page_setup, pages } = jsonData;
  if (typeof pages === 'undefined') {
    pages = jsonData;
  }
  if (
    typeof page_setup === 'object' &&
    typeof page_setup.format === 'string' &&
    typeof page_setup.orientation === 'string'
  ) {
    inst.format = page_setup.format;
    inst.orientation = page_setup.orientation;
  }
  $.each(inst.fabricObjects, function (index, fabricObj) {
    if (pages.length > index) {
      fabricObj.loadFromJSON(pages[index], function () {
        inst.fabricObjectsData[index] = fabricObj.toJSON();
      });
    }
  });
};

PDFAnnotate.prototype.setDefaultTextForTextBox = function (text) {
  var inst = this;
  if (typeof text === 'string') {
    inst.textBoxText = text;
  }
};
module.exports = PDFAnnotate;

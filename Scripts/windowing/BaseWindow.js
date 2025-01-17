/**
	The logical BindKraft windows are heavy construct inteded as a container. The windows may be designed to host specific content - like SimpleViewWindow/ViewWindow or
	other windows. Thus they are responsible for the cosntruction of the skeleton of the UI in relatively bigger pieces which can typicall be arranged in different ways to
	some extent (depends on the implementation, of course).
	
	0. Windows inherit from ViewBase, but for the most part one should forget this and consider mostly their "container" nature. Inheriting from ViewBase gives us freely extras
	like - using the same techniques and components when designing their system parts (captions/toolbars/other UI control elements), but not much else.
	
	1. Templates. Unlike the components designed to be views or reside inside views, windows attach to their templates and can exist detached (but invisible). They are actually used 
	only when they are attached, but unlike the view components they are not lifetime-bound to their places.
	Thus the templates are critically important for the windows even more than they are for their view bound counterparts. The template is determined while the window is constructed in
	this fashion until one is found:
		a. Connector object is passesd as paramter to the constructor. It is expected to return string (html)
		b. A field templateSource
	


	Persisted keys:
	visible,
	sizable,
	draggable,
	SizeLimits,
	Size,
	Pos
	set allow map to the persister you pass to the window in order to allow only some of them
*/

/* CLASSES */
function BaseWindow(viewElement, sf, rect, data) { // The order of the arguments is not important
    this.$isWindowReady = false; // Set to true when the system part of the creation process is complete
    this.root = null;
    this.children = [];
    this.createParameters = BaseWindow.findArgs(arguments);
	ViewBase.call(this, this.createParameters.root); // Should we move that below ???
    var appel = this.as("IAppElement");
    if (appel != null && this.createParameters.approot != null) appel.set_approot(this.createParameters.approot);
    // this.delayedMessages = new CEventQueue();
    var args = this.createParameters;

    //if (args.parent != null) this.set_windowparent(args.parent); // Attach to the hierarchy as soon as possible
    if (args.root != null) {
        // The window will use an existing DOM element as its frame
        this.$finishCreating(null);
    } else {
        if (args.templateSource != null && BaseObject.is(args.templateSource, "Connector")) { // Explixitly given template at instance creation
            args.templateSource.bind(new Delegate(this, this.$finishCreating));
		} else {
			var t = this.get_template();
			if (BaseObject.is(t,"Connector")) {
				t.bind(new Delegate(this, this.$finishCreating));
			} else if (typeof t == "string") {
				this.$finishCreating(t);
			} else {
				// New policy - template must be found up to this point.
				// throw "Template not found"
				this.$finishCreating(null);
			}
		}
        // } else if (BaseObject.is(this.templateSource, "Connector")) {
            // this.templateSource.bind(new Delegate(this, this.$finishCreating));
        // } else {
            // if (this.$finishCreating != null) this.$finishCreating(null);
        // }
    }
    this.on("mousedown", this.$activateWindowFromDOMEvent);
    this.on("keyup", this.$activateWindowFromDOMEvent);
};
BaseWindow.Inherit(ViewBase, "BaseWindow");
BaseWindow.Implement(IWindowTemplate);
BaseWindow.Implement(ITemplateRoot);
BaseWindow.Implement(IExposeCommands);
BaseWindow.Implement(IViewHostWindowImpl);
BaseWindow.Implement(IStructuralQueryProcessorImpl);
BaseWindow.Implement(IStructuralQueryRouter);
BaseWindow.Implement(IStructuralQueryEmiterImpl, "windows", function () { return this.get_approot() || this.get_windowparent(); });   // Re-Implement the emiter for windows
BaseWindow.Implement(IAppletStorage); // Implemented but provided as service only if this.provideAsService=["IAppletStorage"];
BaseWindow.Implement(IAjaxContextParameters);
BaseWindow.Implement(IAjaxReportSinkImpl);
BaseWindow.Implement(IAppElement);
BaseWindow.Implement(IInfoDisplayWindowImpl);
BaseWindow.Implement(IUserData);
BaseWindow.Implement(IAttachedWindowBehaviorsImpl);
BaseWindow.Implement(IWindowTemplateSourceImpl, new Defaults("templateName"))
BaseWindow.Implement ( IProcessAcceleratorsImpl );
BaseWindow.Defaults({
	templateName: new StringConnector('<div data-key="_window"><div><span data-on-click="{bind source=_window path=closeWindow}">close</span>|<span data-bind-text="{bind source=_window path=$caption}"></span></div><div data-key="_client" style="position: relative;overflow: auto;></div></div>')
});

BaseWindow.findArgs = function (args, kind) {
    if (args == null) return null;
    var result = {};
    var prevent_object = false;
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        prevent_object = false;
        // In theory the app is not required to Inherit only AppBase - the Interface is enough, so we leave the arg for further processing 
        if (BaseObject.is(arg, "IApp")) {
            // result.approot = arg;
			jbTrace.log("IApp parameter to a window is now deprecated. Please remove it and attach your root windows only through placeWindow!");
            prevent_object = true;
        }
        // "parent":
        if (BaseObject.is(arg, "BaseWindow")) {
            result.parent = arg;
            continue;
        } else if (arg != null && ((typeof HTMLElement != "undefined" && arg instanceof HTMLElement) || (arg.nodeType && arg.nodeType == 1) || (arg instanceof jQuery))) {
            // root
            result.root = arg;
            continue;
        } else if (typeof arg == "number") {
            result.styles = arg;
            continue;
		} else if (BaseObject.is(arg, "SizeLimits")) {
            result.sizelimits = arg;
            continue;
        } else if (BaseObject.is(arg, "Rect")) {
            result.rect = arg;
            continue;
        } else if (BaseObject.is(arg, "Connector")) {
            result.templateSource = arg;
            continue;
        } else if (BaseObject.is(arg, "ISettingsPersister")) {
            result.persister = arg;
			result.persister.disablePersistence(true);
            continue;
        } else if (BaseObject.is(arg, "string")) {
            result.templateSource = new StringConnector(arg);
            continue;
        } else if (typeof arg == "function" || BaseObject.is(arg, "Delegate")) {
            result.createCallback = arg;
            continue;
        } else if (BaseObject.is(arg, "DeferredExecution")) {
            result.deferredExec = arg;
            continue;
        } else if (BaseObject.is(arg, "TaskDispenser")) {
            result.taskDispenser = arg;
            continue;
        } else if (arg != null && !prevent_object && typeof arg == "object" && !BaseObject.is(arg, "BaseObject")) { // plain objects only
            result.data = arg;
            continue;
        }
    }
    return result;
}.Description( "Matches the element with a property of the class." );

// Misc utilities as static methods
BaseWindow.getElementPositionRect = function (domEl) {
    var el = $(domEl);
    var result = new Rect(el.position());
    result.w = el.width();
    result.h = el.height();
    return result;
}.Description ( "Returns the {h,w} position of element domEl ( string ) " );

BaseWindow.setElementPositionRect = function (domEl, rect) {
    var el = $(domEl);
    if (rect.x != null) el.css({ left: rect.x });
    if (rect.y != null) el.css({ top: rect.y });
    if (rect.w != null) el.width(rect.w);
    if (rect.h != null) el.height(rect.h);
}.Description ( "Sets the position of element domEl (string) with rect ( {h,w} )" );
BaseWindow.$parentlessWindows = [];
BaseWindow.updateParentlessWindows = function(wnd) {
	if (wnd.$windowparent == null && !wnd.get_destroyedwindow()) {
		BaseWindow.$parentlessWindows.addElement(wnd);
	} else {
		BaseWindow.$parentlessWindows.removeElement(wnd);
	}
}
BaseWindow.prototype.$iconpath = null; // Set this in the module-configuration.js file. On some platforms it may be called application-configuration.js.
BaseWindow.prototype.set_iconpath = function(v) {
	this.$iconpath = v;
}
BaseWindow.prototype.get_iconpath = function() {
	return this.$iconpath;
};

BaseWindow.prototype.sysvertical = new InitializeStringParameter("Comma separated list of data-keys of elements to be considered when calculating the height taken by the system part of the window", null);
BaseWindow.prototype.syshorizontal = new InitializeStringParameter("Comma separated list of data-keys of elements to be considered when calculating the width taken by the system part of the window", null);
// Enabled/active - marking intended to help tab sets, lists and other managers of multiple windows to determine which window to show and which to hide from the user completely. All this without the need to add/remove windows to the collection.
BaseWindow.prototype.$enabledwindow = true;
BaseWindow.prototype.get_enabledwindow = function () {
    return this.$enabledwindow;
};
BaseWindow.prototype.set_enabledwindow = function (v) {
    this.$enabledwindow = v;
    this.notifyParent(WindowEventEnum.EnableWindow, { enable: this.$enabledwindow });
    if (!v) {

    }
}.Description ( "Something is missing here !" );
BaseWindow.prototype.$persistSetting = function(key,v) {
	if (this.__obliterated) { return; }
	if (BaseObject.is(this.createParameters.persister,"ISettingsPersister")) {
		var o = IObjectifiable.objectify(v);
		if (o == null) o = v; // risky
		this.createParameters.persister.set_setting(key,o);
	}
}
// ------------ IAjaxReportSinkImpl implementation -------------------------------
BaseWindow.prototype.ajaxOnStartOperation = function (settings) {
};
BaseWindow.prototype.ajaxOnEndOperation = function (settings, result, status) {
};
BaseWindow.prototype.ajaxOnError = function (settings, result, status) {
};
// ------------ IStructuralQueryRouter and throwing implementation -----------------
/* Emitter DEPRECATED: Now implemented using .Implement(IStructuralQueryEmiterImpl);

*/
BaseWindow.prototype.get_structuralQueryRoutingType = function () { return "windows"; };
BaseWindow.prototype.routeStructuralQuery = function (query, processInstructions) {
    var pinst = (processInstructions == null) ? { routingType: "windows"} : processInstructions;
    var cur = this;
    while (cur != null) {
        if (BaseObject.is(cur, "IStructuralQueryRouter") && cur.get_structuralQueryRoutingType() != "windows") {
            return cur.routeStructuralQuery(query, processInstructions);
        } else if (BaseObject.is(cur, "IStructuralQueryProcessor")) {
            if (cur.processStructuralQuery(query, processInstructions)) return true;
        }
        if (BaseObject.is(cur, "BaseWindow")) {
            cur = cur.get_approot() || cur.get_windowparent();
        } else {
            cur = null;
        }
    }
    return false;
};
BaseWindow.prototype.$defaultWindowStyles = WindowStyleFlags.Default;
BaseWindow.prototype.$activatedCssClass = "window_active";
BaseWindow.prototype.$finishCreating = function (viewString) {
    var args = this.createParameters;
    if (args.deferredExec != null) {
        args.deferredExec.add(new Delegate(this, this.$finishCreatingForReal, [viewString]));
    } else {
        this.$finishCreatingForReal(viewString);
    }
};
BaseWindow.prototype.$finishCreatingForReal = function (viewString) {
    //if (viewString != null) this.$customSystemTemplate = viewString;
    var args = this.createParameters;
    if (args.data != null && args.data.caption != null) {
        this.$staticCaption = args.data.caption;
    }
	// Now viewString has to be here
    
    if (this.createParameters.parent) {
        this.set_windowparent(this.createParameters.parent);
    }
    if (args.styles != null) {
        this.$styleFlags = args.styles;
    } else {
        this.$styleFlags = this.$defaultWindowStyles;
    }
	
    this.$ensureCreated(viewString);
	
    if (args.rect != null) this.set_windowrect(args.rect);
	
    this.set_data(args.data);
    // this.notifyChild;
    this.$registerExternalHandlers();
    WindowingMessage.fireOn(this, WindowEventEnum.Create, args.data);
    if (args.createCallback != null) BaseObject.callCallback(args.createCallback, this);
    this.$firstMaterialized = false;
    this.$fireFirstMaterialized();
    this.$firstShown = false;
    this.$fireFirstShown();
};
// Implicit creation
BaseWindow.prototype.$ensureCreated = function (viewString) {
    if (this.root == null) {
        var pel = null;
        var p = this.get_windowparent();
        var pc = null;
        if (p != null) pc = p.get_clientcontainer(this.$clientSlot);
        var tml = viewString;
        var el = $(tml);
        if (el.length > 0) {
            this.root = el.get(0);
            this.OnDOMAttached();
            this.root.activeClass = this;
        }
        if (pc != null) {
            if (!this.$isAttachedToDom()) $(pc).append(el);
        }
        this.initialize();
        this.$applyStyleFlags();
        this.updateTargets();
        this.$isDOMReady = true;
    }
};
BaseWindow.prototype.isParentWindowReady = function () {
    var p = this.get_windowparent();
    if (p == null) return true; // autonomous
    return p.$isWindowReady;
};
// Misc. goodies
BaseWindow.prototype.get_caption = function () { // Quite possibly we will need captions not dictated by views or even windows themselves
	var caption = null;
	
	if (BaseObject.is(this.currentView,"ViewBase")) {
		caption =  this.currentView.get_caption();
	}
	
	if (caption != null) return caption;
	
    if (this.$staticCaption != null) return this.$staticCaption;
	
    return ViewBase.prototype.get_caption.call(this);
}.Description("Returns a caption to be displayed in the system part of the window or in outside tools and UI")
	.Remarks("The current implementation will attempt to extract caption from a hosted view and return it insread of the window's caption, but the logic that decides when this is to be done is not final.");

BaseWindow.prototype.set_caption = function (v) {
    this.$staticCaption = v;
    return ViewBase.prototype.get_caption.call(this);
}.Remarks("Setting caption to the window makes it priority").
	Param("v","The caption to set - string");

// Do not use
/*
BaseWindow.prototype.$reApplyTemplate = function () {
    if (this.root != null) {
        $(this.root).remove();
        this.root = null;
    }
    var p = this.get_windowparent();
    var pc = null;
    if (p != null) pc = p.get_clientcontainer(this.$clientSlot);
    var tml = this.$get_windowHtmlTemplate();
    var el = $(tml);
    if (el.length > 0) {
        this.root = el.get(0);
        this.OnDOMAttached();
        this.root.activeClass = this;
    }
    if (pc != null) {
        if (!this.$isAttachedToDom()) $(pc).append(el);
    }
    this.initialize();
    this.$applyStyleFlags();
    this.updateTargets();

};
*/
// Attach to DOM for root windows
BaseWindow.prototype.isDirectlyAttachedToDom = false;
BaseWindow.prototype.attachInDOM = function (domEl) { // Only the top level windows are permitted to use this.
    if (this.get_windowparent() == null) {
        var el = this.get_windowelement();
        if (el == null) {
            this.$ensureCreated();
        }
        if (el != null && !this.$isAttachedToDom()) {
            $(domEl).append(el);
            this.isDirectlyAttachedToDom = true;
        }
    } else {
		throw "This method must be used only by root windows (usually workspace window).";
	}
};
// Override to extract references to elements of the template before it gets polluted with dynamically created elements
// Extract the client slot(s) for example
BaseWindow.prototype.OnDOMAttached = function () {
    this.$clientSlotElement = $(this.root).find('[data-key="_client"]');
    if (this.$clientSlotElement.length == 0) {
        // try marking
        this.$clientSlotElement = $(this.root).find('[data-sys-client="true"]');
        if (this.$clientSlotElement.length > 1) {
            this.$clientSlotElement = $(this.$clientSlotElement.get(0));
        } else {
			this.$clientSlotElement = $(this.root);
		}
    }
    this.$heightimpactelements = $(this.root).find('[data-sys-height="true"]');
    var handles = $(this.root).find('[data-sys-draghandle="true"]');
    this.$draghandles = (handles != null && handles.length > 0) ? handles : null;
};
// Information about the window
BaseWindow.prototype.isWindowVisibleFlagSet = function () { // Checks only if the visible flag is set. Does not actually guarantee that the window is visible
    return (this.$styleFlags & WindowStyleFlags.visible) ? true : false;
};
BaseWindow.prototype.isWindowVisible = function () {
    var cur = this;
    while (cur != null) {
        if (BaseObject.is(cur, "IWorkspaceWindow") || cur.isDirectlyAttachedToDom) {
            // To be visible the window needs to be ultimately child of an a workspace window - i.e. attached to the DOM somehow
            if (cur.isWindowVisibleFlagSet()) return true;
        }
        if (BaseObject.is(cur, "BaseWindow")) {
            if (!cur.isWindowVisibleFlagSet()) return false;
        }
        cur = cur.get_windowparent();
    }
    return false;
};
BaseWindow.prototype.isWindowMaterial = function () {
    var cur = this;
    while (cur != null) {
        if (BaseObject.is(cur, "IWorkspaceWindow")) {
            // To be material the window needs to be ultimately child of an a workspace window - i.e. attached to the DOM somehow
            if (cur.$isAttachedToDom()) return true;
        }
        cur = cur.get_windowparent();
    }
    return false;
};
BaseWindow.prototype.$firstMaterialized = true; // Reset in the constructor
BaseWindow.prototype.$fireFirstMaterialized = function () {
    if (!this.$firstMaterialized && this.isWindowMaterial()) {
        WindowingMessage.fireOn(this, WindowEventEnum.Materialize, {});
        this.$firstMaterialized = true;
    }
};
BaseWindow.prototype.isChildWindow = function (wnd) {
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i] == wnd) return true;
    }
    return false;
};
// Features
BaseWindow.prototype.$firstShown = true; // The constructor resets this to false. We set it to true in the prototype to prevent first shown from firing when constructor is deffective.
BaseWindow.prototype.$fireFirstShown = function () {
    if (!this.$firstShown && this.isWindowVisible()) {
        WindowingMessage.fireOn(this, WindowEventEnum.FirstShown, { visible: true });
        this.$firstShown = true;
        WindowingMessage.fireOn(this, WindowEventEnum.Show, { visible: this.isWindowVisible(), wasvisible: this.$wasvisible });
    }
};
BaseWindow.prototype.$styleFlags = 0;
// bDontFireEvents instructs the routine to not fire any events / send any messages. This is needed when the styles are to be reapplied if you fear that some
// low level operation may have corrupted them.
//protected//
BaseWindow.prototype.$applyStyleFlags = function (bDontFireEvents) {	
	if (this.__obliterated) { return; }
    var el = $(this.get_windowelement());
    var self = this;
	if (this.$styleFlags & WindowStyleFlags.popup) {
	} else {
	
	}
	//this.$persistSetting("WndowStyleFlags",this.$styleFlags);
	this.$persistSetting("draggable",this.$styleFlags & WindowStyleFlags.draggable);
    if (this.$styleFlags & WindowStyleFlags.draggable) {
        // Just in case detach yourself
        el.unbind("drag");
		if (el.data("draggable") || el.data("uiDraggable")) {
			el.draggable("destroy");
		}
        var opts = {
            distance: 5,
            containment: 'parent',
            handle: WindowingMessage.fireOn(this, WindowEventEnum.GetDragHandle, {})
        };
        el.draggable(opts).bind("drag", function (e, ui) {
            WindowingMessage.fireOn(self, WindowEventEnum.PosChanged, {});
        });
    } else {
        el.unbind("drag");
		if (el.data("draggable") || el.data("uiDraggable")) {
			el.draggable("destroy");
		}
    }
	el.css({ position: "absolute" });
    /* Duplicated - why? If someone knows please tell Jesus
    if (this.$styleFlags & WindowStyleFlags.draggable) {
    el.draggable();
    } else {
    el.draggable("destroy");
    }
    */
	this.$persistSetting("sizable",this.$styleFlags & WindowStyleFlags.sizable);
    if (this.$styleFlags & WindowStyleFlags.sizable) {
		el.resizable({
            containment: 'parent', ghost: false,
            start: function (e, ui) {
                WindowingMessage.fireOn(self, WindowEventEnum.ResizeStart, {});
            },
            stop: function (e, ui) {
                WindowingMessage.fireOn(self, WindowEventEnum.ResizeStop, {});
            },
            resize: function (e, ui) {
                WindowingMessage.fireOn(self, WindowEventEnum.SizeChanged, {});
            }
        });
		
        
    } else {
        el.unbind("resize");
		if (el.data("resizable") || el.data("uiResizable")) {
			el.resizable("destroy");
		}
    }
    if (this.$styleFlags & WindowStyleFlags.fillparent) {
        if (this.$oldWindowRect == null) this.$oldWindowRect = this.get_windowrect();
        el.css({ position: "absolute", width: "100%", height: "100%", left: "0px", top: "0px" });
        //el.css({ position: "relative" });
        if (!bDontFireEvents) {
            WindowingMessage.fireOn(self, WindowEventEnum.SizeChanged, {});
            WindowingMessage.fireOn(self, WindowEventEnum.PosChanged, {});
        }
    } else {
        if (this.$oldWindowRect != null) {
            this.set_windowrect(this.$oldWindowRect);
            this.$oldWindowRect = null;
        }
    }
	this.$persistSetting("visible",this.$styleFlags & WindowStyleFlags.visible);
    if (this.$styleFlags & WindowStyleFlags.visible) {
        if (el.css('display') == "none") {
            el.show();
            if (!bDontFireEvents) {
                WindowingMessage.fireOn(self, WindowEventEnum.Show, { visible: this.isWindowVisible(), wasvisible: false });
            } // guaranteed transition from invisible
        }
    } else {
        if (el.css('display') != "none") {
            el.hide();
            if (!bDontFireEvents) WindowingMessage.fireOn(self, WindowEventEnum.Show, { visible: false, wasvisible: this.$wasvisible });
        }
    }
    if (this.$styleFlags & WindowStyleFlags.adjustclient) {
        this.on_AdjustClient({ dontFireEvents: bDontFireEvents });
    }
};
BaseWindow.prototype.getWindowStyles = function () {
    return WindowingMessage.fireOn(this, WindowEventEnum.GetStyles, {});
};
BaseWindow.prototype.setWindowStyles = function (v, operation) { // operation = 'set', 'reset'
    WindowingMessage.fireOn(this, WindowEventEnum.SetStyles, { styles: v, operation: operation });
};
BaseWindow.prototype.$wasvisible = false;
// Client resizing
BaseWindow.prototype.get_stackingelements = function (kind, clientSlot) { // clientSlot parameter is not currently supported by the built-in functionality
    var _kind = kind;
    var result = $();
    var arr;
    if (kind == null) _kind = "v"; // vertical is default
    if (kind.charAt(0) == "v") {
        var v = this.sysvertical;
        if (v != null && v.length > 0) {
            arr = v.split(",");
            for (var i = 0; i < arr.length; i++) {
                var els = JBUtil.getRelatedElements("./" + arr[i]);
                for (var j = 0; j < els.length; j++) {
                    result.push(els.get(j));
                }
            }
        }
    } else if (kind.charAt(0) == "h") {
        var v = this.syshorizontal;
        if (v != null && v.length > 0) {
            arr = v.split(",");
            for (var i = 0; i < arr.length; i++) {
                var els = JBUtil.getRelatedElements("./" + arr[i]);
                for (var j = 0; j < els.length; j++) {
                    result.push(els.get(j));
                }
            }
        }
    }
    return result;
};
BaseWindow.prototype.$windowVisibleStyle = "block";
// Internal message initiators
BaseWindow.prototype.$activateWindowFromDOMEvent = function (e) {
    WindowManagement.Default().set_activewindow(this);
    if (e != null) e.stopPropagation();
};
// Message handling
BaseWindow.prototype.preprocessWindowEvent = function (evnt) {
	if (this.__obliterated) { return; }
    switch (evnt.type) {
		case WindowEventEnum.Materialize:
			if (BaseObject.is(this.createParameters.persister, "ISettingsPersister")) {
				var persister = this.createParameters.persister;
				if (persister.hasSetting("visible")) {
					this.setWindowStyles(WindowStyleFlags.visible, (persister.get_setting("visible")?"set":"reset"));
				}
				if (persister.hasSetting("sizable")) {
					this.setWindowStyles(WindowStyleFlags.sizable, (persister.get_setting("sizable")?"set":"reset"));
				}
				if (persister.hasSetting("draggable")) {
					this.setWindowStyles(WindowStyleFlags.draggable, (persister.get_setting("draggable")?"set":"reset"));
				}
				if (persister.hasSetting("SizeLimits")) {
					this.createParameters.sizelimits = IObjectifiable.instantiate(persister.get_setting("SizeLimits",null));
				}
				if (persister.hasSetting("Size")) {
					var rect = IObjectifiable.instantiate(persister.get_setting("Size",null));
					if (BaseObject.is(rect,"Rect")) {
						rect.x = null;
						rect.y = null;
						this.set_windowrect(rect);
					}
				}
				if (persister.hasSetting("Pos")) {
					var rect = IObjectifiable.instantiate(persister.get_setting("Pos",null));
					if (BaseObject.is(rect,"Rect")) {
						rect.w = null;
						rect.h = null;
						this.set_windowrect(rect);
					}
				}
				persister.disablePersistence(false);
			}
			break;
        case WindowEventEnum.Close:
            if (this.notifyParent(WindowEventEnum.ChildClosing, { child: this }) === false) { // The parent has the decisive role
                evnt.handled = true;
                return false;
            }
            break;
        case WindowEventEnum.ActivateWindow:
            if (this.notifyParent(WindowEventEnum.ActivateChild, { child: this }) === false) { // The parent has the decisive role
                evnt.handled = true;
                return false;
            }
            break;
		case WindowEventEnum.DeactivateWindow:
            if (this.notifyParent(WindowEventEnum.DeactivateChild, { child: this }) === false) { // The parent has the decisive role
                evnt.handled = true;
                return false;
            }
            break;
        case WindowEventEnum.SizeChanged:
			this.$persistSetting("Size",this.get_windowrect());
			if (BaseObject.is(this.createParameters.sizelimits, "SizeLimits")) {
				this.$persistSetting("SizeLimits",this.createParameters.sizelimits);
				var currentRect = this.get_windowrect();
				var cs = currentRect.get_size();
				var ls; 
				var b = false;
				if (this.createParameters.sizelimits.get_hasminsize()) {
					ls= this.createParameters.sizelimits.get_minsize();
					if (ls.w > cs.w) {
						currentRect.w = ls.w;
						b = true;
					}
					if (ls.h > cs.h) {
						currentRect.h = ls.h;
						b = true;
					}
				}
				
				if (this.createParameters.sizelimits.get_hasmaxsize()) {
					ls = this.createParameters.sizelimits.get_maxsize();
					if (ls.w < cs.w) {
						currentRect.w = ls.w;
						b = true;
					}
					if (ls.h < cs.h) {
						currentRect.h = ls.h;
						b = true;
					}
				}
				
				if (b) {
					this.set_windowrect(currentRect);
				}
			}			
            if (this.$styleFlags & WindowStyleFlags.fillparent) {
                var el = $(this.get_windowelement());
                el.css({ position: "absolute", width: "100%", height: "100%", left: "0px", top: "0px" });
            }
            if ((this.$styleFlags & WindowStyleFlags.adjustclient) != 0) {
                WindowingMessage.fireOn(this, WindowEventEnum.AdjustClient, {});
            }
            break;
        case WindowEventEnum.Show:
            if (this.$wasvisible == BaseObject.getProperty(evnt, "data.visible")) {
                evnt.handled = true; // Stop the unneeded message
            }
            break;
    }
};
BaseWindow.prototype.$trackEvents = null; // Can be set to a function that is called to report everything that happens.
/*sealed*/BaseWindow.prototype.$handleWindowEvent = function (evnt) {
    if (evnt != null) {
		if ( typeof this.$trackEvents == "function") {
			this.$trackEvents.call(null, this, evnt);
		}
        var r = this.preprocessWindowEvent(evnt);
        if (evnt.handled) return r;
		if (typeof this["on_" + evnt.type] == "function") {
            r = this["on_" + evnt.type].call(this, evnt);
        }
		// TODO: Should this be possible?
		//if (evnt.handled) return r;
		
		// Code of the handleOn is moved inline above. // V: 2.15.1
        // r = evnt.handleOn(this);
        return this.handleWindowEvent(evnt, r);
    }
    return null;
};
/*virtual*/BaseWindow.prototype.handleWindowEvent = function (evnt, currentResult) { // Overridable
    return this.handleWindowEventDefault(evnt, currentResult);
};

//fired, when a max, min happens
BaseWindow.prototype.windowmaxminchanged = new InitializeEvent("Fired when minimize/maximize/normal state of the windows changes.");

/*virtual*/BaseWindow.prototype.handleWindowEventDefault = function (evnt, currentResult) {
	if (this.__obliterated) { return; }
    var i, w;
    this.$notifyExternalHandlers(evnt);
	if (this.is("IAttachedWindowBehaviors")) {
		this.adviseAttachedBehaviors(evnt);
	}
    if (evnt.handled) return currentResult;
    switch (evnt.type) {
        case WindowEventEnum.Create:
            if (evnt.data != null && evnt.data.caption != null) {
                this.$staticCaption = evnt.data.caption;
            }
            WindowingMessage.fireOn(this, WindowEventEnum.Show, { visible: this.isWindowVisible(), wasvisible: this.$wasvisible });
            break;
        case WindowEventEnum.Materialize:
            this.notifyChildren(WindowEventEnum.IsMaterialized, {});
            break;
        case WindowEventEnum.IsMaterialized:
            this.$fireFirstMaterialized();
            break;
        case WindowEventEnum.SetStyles:
            if (evnt.data.operation != null) {
                if (evnt.data.operation == "set") {
                    this.$styleFlags |= evnt.data.styles;
                } else if (evnt.data.operation == "reset") {
                    this.$styleFlags &= evnt.data.styles ^ 0xFFFFFFFF;
                }
            } else {
                this.$styleFlags = evnt.data.styles;
            }
            this.$applyStyleFlags();			
			if(this.windowmaxminchanged && this.windowmaxminchanged.invoke) this.windowmaxminchanged.invoke(this,null);
            break;
        case WindowEventEnum.GetStyles:
            return this.$styleFlags;
            break;
        case WindowEventEnum.GetDragHandle:
            return this.$draghandles;
        case WindowEventEnum.PosChanged:
			this.$persistSetting("Pos",this.get_windowrect());
            if ((this.$styleFlags & WindowStyleFlags.parentnotify) != 0) {
                WindowingMessage.fireOn(this.get_windowparent(), WindowEventEnum.ChildMoved, { rect: this.get_windowrect() });
            }
            break;
        case WindowEventEnum.SizeChanged:
            if ((this.$styleFlags & WindowStyleFlags.parentnotify) != 0) {
                WindowingMessage.fireOn(this.get_windowparent(), WindowEventEnum.ChildResized, { rect: this.get_windowrect() });
            }
            break;
        case WindowEventEnum.Show:
            // TODO: Advise children if the visual state actually changes
            if ((this.$styleFlags & WindowStyleFlags.parentnotify) != 0) {
                WindowingMessage.fireOn(this.get_windowparent(), WindowEventEnum.ChildShown, { visible: this.isWindowVisible(), wasvisible: this.$wasvisible });
            }
            this.$fireFirstShown();
            if (this.isWindowVisible() && ((this.$styleFlags & WindowStyleFlags.adjustclient) != 0)) {
                WindowingMessage.fireOn(this, WindowEventEnum.AdjustClient, {});
            }
            this.notifyChildren(WindowEventEnum.Show, {}, function (_child, _event, _data) {
                _data.visible = _child.isWindowVisible(); // wasvisible remains unknown
                _data.wasvisible = _child.$wasvisible;
            });
            this.$wasvisible = this.isWindowVisible();
            break;
		case WindowEventEnum.Broadcast:
		case WindowEventEnum.BroadcastAction:
				if (evnt.type == WindowEventEnum.BroadcastAction && evnt.data != null && BaseObject.isCallback(evnt.data.action)) {
					if (evnt.data.condition == null || (BaseObject.isCallback(evnt.data.condition) && BaseObject.callCallback(evnt.data.condition,this,evnt.data))) {
						BaseObject.callCallback(evnt.data.action, this,evnt.data);
					}
				}
				if (this.$styleFlags & WindowStyleFlags.nobroadcast) {
					break;
				}
				// Post the messages further (these are considered potentially heavy operations and are nexttick posted)
				if (this.children != null && this.children.length > 0) {
					for (i = 0; i < this.children.length;i++) {
						if (BaseObject.is(this.children[i],"BaseWindow")) {
							WindowingMessage.postTo(this.children[i],evnt.type,evnt.data);
						}
					}
				}
			break;
        case WindowEventEnum.ParentChanged:
            this.$fireFirstShown(); // If this makes the window visible ...
            this.$fireFirstMaterialized(); // If this materializes it
			BaseWindow.updateParentlessWindows(this);
            break;
        case WindowEventEnum.ActivateWindow:
            // To do: Change the style  of the active window (more complicated than just reacting)
			if (this.$activatedCssClass != null) {
				w = this.get_windowelement();
				if (w != null) {
					$(w).addClass(this.$activatedCssClass);
				}
			}
            break;
		case WindowEventEnum.DeactivateWindow:
			if (this.$activatedCssClass != null) {
				w = this.get_windowelement();
				if (w != null) {
					$(w).removeClass(this.$activatedCssClass);
				}
			}
			break;
        case WindowEventEnum.ActivateChild:
			if (evnt.data != null && evnt.data.child != this) {
                var cordered = this.children.sort(function (w1, w2) {
                    if (w1 == null) return -1;
                    if (w2 == null) return 1;
					if (w1.getWindowStyles() & WindowStyleFlags.topmost) {
						if (w2.getWindowStyles() & WindowStyleFlags.topmost) {
							if (evnt.data.child == w1) return 1;
							return (w1.get_zorder() - w2.get_zorder());
						} else { // not topmost
							return 1;
						}
					} else if (w2.getWindowStyles() & WindowStyleFlags.topmost) {
						return -1; // never over the w2
					}
                    if (evnt.data.child == w1) return 1;
                    if (evnt.data.child == w2) return -1;
					
                    var z1 = w1.get_zorder(), z2 = w2.get_zorder();
                    return (z1 - z2);
                });
                this.children = cordered;
                for (var i = 0; i < this.children.length; i++) {
                    if (BaseObject.is(this.children[i], "BaseWindow")) {
                        this.children[i].set_zorder(i);
                    }
                }
                WindowingMessage.fireOn(this, WindowEventEnum.ActivateWindow, {});
            }
            
            break;
        case WindowEventEnum.Close:
            if (currentResult === false) break;
            // Note that this message does not propagate to children!
            // This is the correct behavior, otherwise any child will be able to prevent the closure of the parent.
            // not cancelled
            WindowingMessage.fireOn(this, WindowEventEnum.Destroy, {});
            break;
        case WindowEventEnum.Destroy:
			// Try to reparent the window. The reparenting asks both the current and future parent and proceeds only if both allow it.
			w = this.get_windowparent();
            if (this.set_windowparent(null) === false) return false;
			// Destroy propagates to children unlike close.
            this.notifyChildren(WindowEventEnum.Destroy, {});
            if (this.$clientSlot != null) this.$clientSlot = null;
            if (this.$clientSlotElement != null) this.$clientSlotElement = null;
            
            WindowingMessage.fireOn(w, WindowEventEnum.ChildDestroyed, { child: this });
			if (this.root != null) $(this.root).Remove();
            this.$destroyedWindow = true; // In case there are dead references left there must be a way to find out if this instance is usable
            break;
    }
    if (BaseObject.is(evnt, "WindowingParentNotifyMessage") && evnt.target == this) {
        evnt.dispatchOn(this.get_windowparent());
    }
	// TODO: There is something weird in the following code - why unqueue only the same tasks?
    if (this.createParameters != null && this.createParameters.taskDispenser != null) {
        var arrTasks = this.createParameters.taskDispenser.query(this, evnt.type);
        if (BaseObject.is(arrTasks, "Array")) {
            for (var i = 0; i < arrTasks.length; i++) {
                if (BaseObject.is(arrTasks[i], "WindowingMessage")) {
                    this.createParameters.taskDispenser.done(arrTasks[i]);
                    EventPump.Default().post(arrTasks[i]);
                }
            }
        }
    }
    return currentResult;
};

BaseWindow.prototype.$externalHandlers = null;
BaseWindow.prototype.registerExternalHandler = function (msgType, handler) {
    if (this.$externalHandlers == null) this.$externalHandlers = {};
    if (BaseObject.is(msgType, "Array")) {
        for (var i = 0; i < msgType.length; i++) {
            if (msgType[i].charAt(0) == "$") {
                var ed = this[msgType[i].slice(1)];
                if (BaseObject.is(ed, "EventDispatcher")) {
                    ed.add(handler);
                } else {
                    throw "The event dispatcher (" + msgType[i] + ") does not exist in " + this.classType();
                }
            } else {
                if (this.$externalHandlers[msgType[i]] == null) this.$externalHandlers[msgType[i]] = new EventDispatcher();
                this.$externalHandlers[msgType[i]].add(handler);
            }
        }
    } else {
        if (msgType.charAt(0) == "$") {
            var ed = this[msgType.slice(1)];
            if (BaseObject.is(ed, "EventDispatcher")) {
                ed.add(handler);
            } else {
                throw "The event dispatcher (" + msgType + ") does not exist in " + this.classType();
            }
        } else {
            if (this.$externalHandlers[msgType] == null) this.$externalHandlers[msgType] = new EventDispatcher();
            this.$externalHandlers[msgType].add(handler);
        }
    }
};
BaseWindow.prototype.unregisterExternalHandler = function (msgType, handler) {
    if (this.$externalHandlers != null) {
        if (msgType == null) {
            if (handler != null) {
                // the handler everywhere
                for (k in this.$externalHandlers) {
                    if (BaseObject.is(this.$externalHandlers[k], "EventDispatcher")) {
                        this.$externalHandlers[k].remove(handler);
                    }
                }
            }
        } else {
            var ed = this.$externalHandlers[msgType];
            if (BaseObject.is(ed, "EventDispatcher")) {
                if (handler == null) {
                    this.$externalHandlers[msgType] = null; // remove all the handlers
                } else {
                    ed.remove(handler);
                }
            }
        }
    }
};

/*private*/BaseWindow.prototype.$registerExternalHandlers = function () {
    if (this.createParameters != null && this.createParameters.data != null) {
        for (var k in this.createParameters.data) {
            if (k.slice(0, 3) == "on_") {
                var msgType = k.slice(3);
                if (msgType.length > 0 && this.createParameters.data[k] != null) {
                    this.registerExternalHandler(msgType, this.createParameters.data[k]);
                }
            }
        }
    }
};
/*sealed*/BaseWindow.prototype.$notifyExternalHandlers = function (msg) {
    if (BaseObject.is(msg, "WindowingMessage")) {
        if (this.$externalHandlers != null && BaseObject.is(this.$externalHandlers[msg.type], "EventDispatcher")) {
            this.$externalHandlers[msg.type].invoke(msg);
        }
    }
};
// Default event handlers
BaseWindow.prototype.on_ChildAdded = function (evnt) {

};
BaseWindow.prototype.$isAttachedToDom = function () {
    var w = $(this.get_windowelement());
    var p = w.parent();
    if (p.length > 0) return true;
    return false;
};
// Children/Parents
// Use this function in specialized windows that need to notify their parents for events happening in/with them with special messages
//  ex: this.notifyParent("pageAdded",{page: newwnd});
//  The message is sent first to the child and can be recognized by checking if msg.target == this
//  The child itself can Implement on_ method for the notification and discard it by making it handled = true
//  If the child has children in turn and expects notifications the implementation should use:
//  if (this.isNotification(msg)) { handle notification from children } else { handle notification about to be sent to the parent }
BaseWindow.prototype.notifyParent = function (eventType, eventData) {
    var p = this.get_windowparent();
    if (p != null) {
        WindowingParentNotifyMessage.fireOn(this, eventType, eventData);
    }
};
BaseWindow.prototype.askParent = function (eventType, eventData) {
    var p = this.get_windowparent();
    if (p != null) {
        return WindowingMessage.sendTo(p, evntType, evntData);
    }
    return null;
};
BaseWindow.prototype.notifyChild = function (_child, eventType, eventData, dataManipulatorCallback) {
    if (_child != null && BaseObject.is(_child, "BaseWindow")) {
        if (this.children.findElement(_child) >= 0) {
            BaseObject.callCallback(dataManipulatorCallback, _child, eventType, eventData);
            return WindowingMessage.fireOn(_child, eventType, eventData);
        } else {
            jbTrace.log("BaseWindow.notifyChild: The window specified is not a child of this window.");
        }
    } else if (_child == null && !IsNull(this.children)) { // boradcast to all children
        var result;
        for (var i = 0; i < this.children.length; i++) {
            BaseObject.callCallback(dataManipulatorCallback, this.children[i], eventType, eventData);
            var r = WindowingMessage.fireOn(this.children[i], eventType, eventData);
            if (typeof result == "undefined") result = r;
        }
        return result;
    }
};
BaseWindow.prototype.notifyChildren = function (eventType, eventData, dataManipulatorCallback) {
    this.notifyChild(null, eventType, eventData, dataManipulatorCallback);
};
// Helper that recognizes notifications from children. Use in handlers in the parent.
BaseWindow.prototype.isNotification = function (msg) {
    return (msg.target != this);
};
BaseWindow.prototype.children = null;  // new InitializeArray("Array of all the child windows, should not be used directly");
BaseWindow.prototype.get_children = function() {
	if (this.children != null) {
		return this.children.Select(function(idx, item) {
			if (item != null && item.isWindowVisible()) return item;
			return null;
		});
	}
	return this.children;
}
// For internal use. Holds the client slot into which te child should bind its DOM (can be null and is most often null)
// It is dynamically set/reset by addChild and others
BaseWindow.prototype.$clientSlot = null; 
BaseWindow.prototype.$addChild = function (wnd, param) {
    wnd.$clientSlot = param;
    var client = this.get_clientcontainer(param);
    var child = wnd.get_windowelement();
    this.children.addElement(wnd);
	if ((wnd.getWindowStyles() & WindowStyleFlags.popup) != 0) {
		var workspace = Shell.get_workspacewindow();
		if (BaseObject.is(workspace, "IWorkspaceWindow")) {
			workspace.$addPopup(wnd);
		} else {
			throw "Popups require workspace window. Workspace is either not available or does not Implement IWorkspaceWindow";
		}
	} else {
		if (client != null && child != null) {
			if (!wnd.$isAttachedToDom()) $(client).append(child);
		}
	}
};
BaseWindow.prototype.addChild = function (wnd, param) {
    if (BaseObject.is(wnd, "BaseWindow")) {
        if (WindowingMessage.fireOn(this, WindowEventEnum.AddingChild, { child: wnd, reason: "addchild", childParam: param }) === false) return false;
        if (WindowingMessage.fireOn(wnd.$windowparent, WindowEventEnum.RemovingChild, { child: wnd, reason: "addchild", childParam: param }) === false) return false;
        var oldp = wnd.$windowparent;
        if (BaseObject.is(wnd.$windowparent, "BaseWindow")) {
            wnd.$windowparent.$removeChild(wnd);
        }
        this.$addChild(wnd, param);
        wnd.$windowparent = this;
        WindowingMessage.fireOn(this, WindowEventEnum.ChildAdded, { child: wnd, reason: "addchild", childParam: param });
        WindowingMessage.fireOn(wnd, WindowEventEnum.ParentChanged, { oldParent: oldp, newParent: this, childParam: param });
    } else {
        throw "Only Ancestors of BaseWindow can be added as children";
    }
} .Description("The param (2-nd argument) is optional and is used by specialized windows to place children in specific client slots (dom elements) or put the specific children under specific layout management.");
BaseWindow.prototype.$removeChild = function (wnd) { // no events
    this.children.removeElement(wnd);
	wnd.$clientSlot = null;
	if ((wnd.getWindowStyles() & WindowStyleFlags.popup) != 0) {
		// Deprecated branch
		var workspace = Shell.get_workspacewindow();
		if (BaseObject.is(workspace, "IWorkspaceWindow")) {
			workspace.$removePopup(wnd);
		} else {
			throw "Popups require workspace window. Workspace is either not available or does not Implement IWorkspaceWindow";
		}
	} else {
		if (wnd.root != null) {
			try {
				wnd.root.parentElement.removeChild(wnd.root);
			} catch(e) {
				// Eat it up
			}
			// $(wnd.root).detach();
		}
	}
};
BaseWindow.prototype.removeChild = function (wnd) {
    if (BaseObject.is(wnd, "BaseWindow")) {
        if (WindowingMessage.fireOn(this, WindowEventEnum.RemovingChild, { child: wnd, reason: "removechild" }) === false) return false;
        this.$removeChild(wnd);
        wnd.$windowparent = null;
        WindowingMessage.fireOn(this, WindowEventEnum.ChildRemoved, { child: wnd, reason: "removechild" });
    }
    // TODO: Deal with other ways to determine the child window to remove
};
BaseWindow.prototype.get_childwindow = function (idx) {
    if (this.children != null && idx >= 0 && idx < this.children.length) {
        return this.children[idx];
    }
    return null;
};
BaseWindow.prototype.$windowparent = null;
BaseWindow.prototype.set_windowparent = function (p, param) {
    var oldp = this.$windowparent;
    if (WindowingMessage.fireOn(oldp, WindowEventEnum.RemovingChild, { child: this, reason: "setparent" }) === false) return false;
    if (WindowingMessage.fireOn(p, WindowEventEnum.AddingChild, { child: this, reason: "setparent", childParam: param }) === false) return false;
    if (BaseObject.is(oldp, "BaseWindow")) {
        if (oldp.$removeChild(this) === false) return false;
    }
    if (BaseObject.is(p, "BaseWindow")) {
        if (p.$addChild(this, param) === false) return false;
    }
    this.$windowparent = p;
    this.$applyStyleFlags(); // TODO: Is this necessary? It seems that so far we manage to apply any flag without need to know our parent, but this may change!
    //if (oldp != p) this.$fireFirstShown(); // If this makes the window visible ...
    //if (oldp == null && p != null) this.$fireFirstMaterialized();
    WindowingMessage.fireOn(this, WindowEventEnum.ParentChanged, { oldParent: oldp, newParent: p, childParam: param });
    WindowingMessage.fireOn(oldp, WindowEventEnum.ChildRemoved, { child: this, reason: "setparent" });
    WindowingMessage.fireOn(p, WindowEventEnum.ChildAdded, { child: this, reason: "setparent", childParam: param });
} .Description("Parameters parent and optional param which plays the same role as the second param in addChild - gives the parent a hint what kind of child is this - usable only in specialized containers.");
BaseWindow.prototype.get_windowparent = function () {
    return this.$windowparent;
};
BaseWindow.prototype.$windowowner = null;
BaseWindow.prototype.set_windowowner = function(w) {
	this.$windowowner = w;
}
BaseWindow.prototype.get_windowowner = function() {
	if (this.$windowowner == null) return this.get_windowparent();
	return this.$windowowner;
}
BaseWindow.prototype.closeWindow = function () {
    return WindowingMessage.fireOn(this, WindowEventEnum.Close, { reason: "closeWindow" });
} .Description("Attempts to close and destroy the window. The window can still return false to the Close message and cancel its destruction.");
BaseWindow.prototype.destroy = function () {
    WindowingMessage.fireOn(this, WindowEventEnum.Destroy, {});
} .Description("Imperative destruction.");
// Standard instance methods
BaseWindow.prototype.get_clientcontainer = function (param) {
    if (this.$clientSlotElement != null) {
		if (BaseObject.isJQuery(this.$clientSlotElement)) {
			if (this.$clientSlotElement.length > 0) return this.$clientSlotElement.get(0);
			return null;
		}
		return this.$clientSlotElement;
	}
    var c = this.childElement("_client");
    return (c == null) ? this.root : c;
} .Description("Returns the element which contains the internals of the window - mostly children. Override to return selective elements in specialized windows.");
BaseWindow.prototype.get_windowelement = function () {
    return this.root;
} .Description("Returns the DOM element over which the window is defined/attached.");
BaseWindow.prototype.get_windowrect = function () {
    return BaseWindow.getElementPositionRect(this.root);
};
BaseWindow.prototype.set_windowrect = function (rect) {
    BaseWindow.setElementPositionRect(this.root, rect);
    if (BaseObject.is(rect, "Point")) {
        if (rect.x != null && rect.y != null) {
            WindowingMessage.fireOn(this, WindowEventEnum.PosChanged, {});
        }
        if (BaseObject.is(rect, "Rect")) {
            if (rect.w != null && rect.h != null) {
                WindowingMessage.fireOn(this, WindowEventEnum.SizeChanged, {});
            }
        }
    }
};
BaseWindow.prototype.get_zorder = function () {
    var w = this.get_windowelement();
    if (w != null) return parseInt($(w).css("z-index"), 10);
    return 0;
};
BaseWindow.prototype.set_zorder = function (ord) {
    var w = this.get_windowelement();
    if (w != null) $(w).css("z-index", ord);
};
BaseWindow.prototype.maximizeWindow = function () {
    this.setWindowStyles(WindowStyleFlags.fillparent, "set");
};
BaseWindow.prototype.normalizeWindow = function () {
    this.setWindowStyles(WindowStyleFlags.fillparent, "reset");
};
BaseWindow.prototype.toggleMaximize = function () {
	if ((this.getWindowStyles() & WindowStyleFlags.fillparent) != 0) {
		this.setWindowStyles(WindowStyleFlags.fillparent, "reset");
	} else {
		this.setWindowStyles(WindowStyleFlags.fillparent, "set");
	}
};
// --------------------- new state related stuff (2017) ------------------

BaseWindow.prototype.activateWindow = function() {
	WindowManagement.Default().set_activewindow(this);
}.Description("Recommended method for programmatic activation of a window. The activation will take it to the front together with its parents and assign the focus to the activated window (focus is not yet fully managed at the time of writing this note)");
BaseWindow.prototype.get_ismaximized = function() {
	var s = this.getWindowStyles();
	if (Math.bitsTest(s, WindowStyleFlags.fillparent | WindowStyleFlags.visible)) return true;
	return false;
}.Description("Window is considered maximized if it is visible and also configured to fill its parent client area. The property checks if that is true.");
BaseWindow.prototype.get_isminimized = function() {
	var s = this.getWindowStyles();
	if ((s & WindowStyleFlags.visible) == 0) return true;
	return false;
}.Description("Returns true if the window has the visible style not set. Such a window can be considered minimized by its parent.");
BaseWindow.prototype.get_isvisible = function() {
	return this.isWindowVisible();
}.Description("Returns true/false to indicate if the window is actually visible or not. This takes into account not only the visible style flag, but also parent visibility and so on.");

// --------------------- END SECTION -------------------------------------

BaseWindow.prototype.get_clientrect = function (param) {
    var cel = this.get_clientcontainer(param);
    return BaseWindow.getElementPositionRect(cel);
};
BaseWindow.prototype.get_destroyedwindow = function () {
    return this.$destroyedWindow;
};
BaseWindow.prototype.get_heightimpactelements = function () {
    return this.$heightimpactelements;
};
BaseWindow.prototype.$autoCalcClientHeight = function () {
    var els = this.get_heightimpactelements();
    var winHeight = parseFloat(this.root.clientHeight);
    var sysHeight = 0;
    if (els != null) {
        for (var i = 0; i < els.length; i++) {
            var el = $(els[i]);
            if (el.is(":visible")) {
                sysHeight += el.outerHeight(); //parseFloat(el.css('height'));
            }
        }
    }
    return winHeight - sysHeight;
};
/*protected*/BaseWindow.prototype.$adjustClient = function () {
    var c = this.get_clientcontainer(); // The default behaviour deals with single client area only
    if (c != null) {
        var clnt = $(c);
        if (clnt.is(':visible')) {
            var h = this.$autoCalcClientHeight();
            if (h > 0) {
                clnt.css("height", h + "px"); // todo: We need to measure borders, margins and so on (if we want to be precise that is).
                return true;
            }
        }
    }
    return false;
};
BaseWindow.prototype.on_AdjustClient = function (msg) { // Emited by the SizeChanged default processing when the window has the adjustclient style flag
    if (this.$adjustClient()) {
        if (msg == null || !msg.dontFireEvents) {
            this.notifyChildren(WindowEventEnum.SizeChanged, {});
        }
    }
};

//BaseWindow.prototype.on_SizeChanged = function (param) {
////    $(this.root).ng_HeightFloat(param.data.height - getElementShellHeight($(this.root)));
////    var clientHeight = this.getClientHeight();
////    this.child('_client').first().ng_HeightFloat(clientHeight);
////        this.notifyChild(null, WindowEventEnum.SizeChanged, { height: clientHeight, vertical: param.data.vertical, horizontal: param.data.horizontal });
//    this.notifyChild(null, WindowEventEnum.SizeChanged, { vertical: param.data.vertical, horizontal: param.data.horizontal });
//};

BaseWindow.prototype.getClientHeight = function () {
    return this.$autoCalcClientHeight();
    //    var offset = 0;
    //    if (this.child('_windowcaption').length > 0) {
    //        if (this.child('_windowcaption').first().parent()[0] == this.root) {
    //            offset += this.child('_windowcaption')[0].offsetHeight;
    //        }
    //    }
    //    var clientHeight = $(this.root).ng_HeightFloat() - 30;
    //    return clientHeight;
};
// BaseWindow.prototype.get_caption = function () { return "BaseWindow"; };

BaseWindow.prototype.findViewClassInstance = function (className) {
    var result = [];
    if (BaseObject.is(this.currentView, className)) {
        result.push(this.currentView);
    }
    else {
        $.each(this.children, function () {
            result = result.concat(this.findViewClassInstance(className));
        });
    }
    return result;
};

BaseWindow.prototype.on_GetFocus = function (params) {
    if (!IsNull(this.selectPage) && !IsNull(params) && !IsNull(params.data) && !IsNull(params.data.windowToFocus)) {
        this.selectPage(params.data.windowToFocus);
    }
    this.notifyParent(WindowEventEnum.GetFocus, { windowToFocus: this });
};
// ---------------------- Structural queries processing -----------------------
BaseWindow.prototype.provideAsServices = new InitializeArray("Assign an array of strings - names of supported interfaces by your class to enable those to be provided as services", ["Do not provide services"]);
BaseWindow.onStructuralQuery("FindServiceQuery", function (query, opts) {
    if (FindServiceQuery.handle(this, query, this.provideAsServices)) return true;
});

BaseWindow.prototype.get_localajaxcontextparameter = function (param) {
    if (this.$ajaxcontextparameter != null && this.$ajaxcontextparameter["" + param] != null) return this.$ajaxcontextparameter["" + param];
    return null;
};
BaseWindow.prototype.get_ajaxcontextparameter = function (param) {
    var result = this.get_localajaxcontextparameter(param);
    if (result != null || this.isFinalAuthority(param)) return result;
    // Call the hierarchy
    var query = new AjaxContextParameterQuery(param);
    if (this.throwDownStructuralQuery(query)) {
        return query.result;
    }
    return null;
};
BaseWindow.prototype.set_localajaxcontextparameter = function (param, v) {
    if (this.$ajaxcontextparameter == null) this.$ajaxcontextparameter = {};
    this.$ajaxcontextparameter["" + param] = v;
};
// Final authority for certain context parameters. This is prepared to handle this on parameter specific basis one day, but for now it works in general manner.
BaseWindow.prototype.$isFinalAuthority = false;
BaseWindow.prototype.isFinalAuthority = function (param) { // Override this in Applet root classes to stop searching for parameters to the shell
    return this.$isFinalAuthority;
};
BaseWindow.prototype.setFinalAuthority = function (param, v) {
    if (arguments.length == 1) {
        this.$isFinalAuthority = param;
    } else if (arguments.length > 1) {
        this.$isFinalAuthority = v;
    }
};
BaseWindow.onStructuralQuery("AjaxContextParameterQuery", function (query, processInstructions) {
    if (this.is("IAjaxContextParameters")) {
        var result = this.get_localajaxcontextparameter(query.requestedParameter);
        if (result != null || this.isFinalAuthority(query.requestedParameter)) {
            query.result = result;
            return true;
        }
    }
    return null;
});
const updateQueue = []; // Tiny API-only polyfill for trustedTypes

/* eslint-disable */

if (globalThis.trustedTypes === void 0) {
  globalThis.trustedTypes = {
    createPolicy: (name, rules) => rules
  };
}

const fastHTMLPolicy = globalThis.trustedTypes.createPolicy("fast-html", {
  createHTML: html => html
});
/* eslint-enable */

let htmlPolicy = fastHTMLPolicy;

function processQueue() {
  const capacity = 1024;
  let index = 0;

  while (index < updateQueue.length) {
    const task = updateQueue[index];
    task.call();
    index++; // Prevent leaking memory for long chains of recursive calls to `queueMicroTask`.
    // If we call `queueMicroTask` within a MicroTask scheduled by `queueMicroTask`, the queue will
    // grow, but to avoid an O(n) walk for every MicroTask we execute, we don't
    // shift MicroTasks off the queue after they have been executed.
    // Instead, we periodically shift 1024 MicroTasks off the queue.

    if (index > capacity) {
      // Manually shift all values starting at the index back to the
      // beginning of the queue.
      for (let scan = 0, newLength = updateQueue.length - index; scan < newLength; scan++) {
        updateQueue[scan] = updateQueue[scan + index];
      }

      updateQueue.length -= index;
      index = 0;
    }
  }

  updateQueue.length = 0;
}

const marker = `fast-${Math.random().toString(36).substring(7)}`;
/** @internal */

const _interpolationStart = `${marker}{`;
/** @internal */

const _interpolationEnd = `}${marker}`;
/**
 * Common DOM APIs.
 * @public
 */

const DOM = Object.freeze({
  /**
   * Indicates whether the DOM supports the adoptedStyleSheets feature.
   */
  supportsAdoptedStyleSheets: Array.isArray(document.adoptedStyleSheets) && "replace" in CSSStyleSheet.prototype,

  /**
   * Sets the HTML trusted types policy used by the templating engine.
   * @param policy - The policy to set for HTML.
   * @remarks
   * This API can only be called once, for security reasons. It should be
   * called by the application developer at the start of their program.
   */
  setHTMLPolicy(policy) {
    if (htmlPolicy !== fastHTMLPolicy) {
      throw new Error("The HTML policy can only be set once.");
    }

    htmlPolicy = policy;
  },

  /**
   * Turns a string into trusted HTML using the configured trusted types policy.
   * @param html - The string to turn into trusted HTML.
   * @remarks
   * Used internally by the template engine when creating templates
   * and setting innerHTML.
   */
  createHTML(html) {
    return htmlPolicy.createHTML(html);
  },

  /**
   * Determines if the provided node is a template marker used by the runtime.
   * @param node - The node to test.
   */
  isMarker(node) {
    return node && node.nodeType === 8 && node.data.startsWith(marker);
  },

  /**
   * Given a marker node, extract the {@link Directive} index from the placeholder.
   * @param node - The marker node to extract the index from.
   */
  extractDirectiveIndexFromMarker(node) {
    return parseInt(node.data.replace(`${marker}:`, ""));
  },

  /**
   * Creates a placeholder string suitable for marking out a location *within*
   * an attribute value or HTML content.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by binding directives.
   */
  createInterpolationPlaceholder(index) {
    return `${_interpolationStart}${index}${_interpolationEnd}`;
  },

  /**
   * Creates a placeholder that manifests itself as an attribute on an
   * element.
   * @param attributeName - The name of the custom attribute.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by attribute directives such as `ref`, `slotted`, and `children`.
   */
  createCustomAttributePlaceholder(attributeName, index) {
    return `${attributeName}="${this.createInterpolationPlaceholder(index)}"`;
  },

  /**
   * Creates a placeholder that manifests itself as a marker within the DOM structure.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by structural directives such as `repeat`.
   */
  createBlockPlaceholder(index) {
    return `<!--${marker}:${index}-->`;
  },

  /**
   * Schedules DOM update work in the next async batch.
   * @param callable - The callable function or object to queue.
   */
  queueUpdate(callable) {
    if (updateQueue.length < 1) {
      window.requestAnimationFrame(processQueue);
    }

    updateQueue.push(callable);
  },

  /**
   * Resolves with the next DOM update.
   */
  nextUpdate() {
    return new Promise(resolve => {
      DOM.queueUpdate(resolve);
    });
  },

  /**
   * Sets an attribute value on an element.
   * @param element - The element to set the attribute value on.
   * @param attributeName - The attribute name to set.
   * @param value - The value of the attribute to set.
   * @remarks
   * If the value is `null` or `undefined`, the attribute is removed, otherwise
   * it is set to the provided value using the standard `setAttribute` API.
   */
  setAttribute(element, attributeName, value) {
    if (value === null || value === undefined) {
      element.removeAttribute(attributeName);
    } else {
      element.setAttribute(attributeName, value);
    }
  },

  /**
   * Sets a boolean attribute value.
   * @param element - The element to set the boolean attribute value on.
   * @param attributeName - The attribute name to set.
   * @param value - The value of the attribute to set.
   * @remarks
   * If the value is true, the attribute is added; otherwise it is removed.
   */
  setBooleanAttribute(element, attributeName, value) {
    value ? element.setAttribute(attributeName, "") : element.removeAttribute(attributeName);
  }

});

function spilloverSubscribe(subscriber) {
  const spillover = this.spillover;
  const index = spillover.indexOf(subscriber);

  if (index === -1) {
    spillover.push(subscriber);
  }
}

function spilloverUnsubscribe(subscriber) {
  const spillover = this.spillover;
  const index = spillover.indexOf(subscriber);

  if (index !== -1) {
    spillover.splice(index, 1);
  }
}

function spilloverNotifySubscribers(args) {
  const spillover = this.spillover;
  const source = this.source;

  for (let i = 0, ii = spillover.length; i < ii; ++i) {
    spillover[i].handleChange(source, args);
  }
}

function spilloverHas(subscriber) {
  return this.spillover.indexOf(subscriber) !== -1;
}
/**
 * An implementation of {@link Notifier} that efficiently keeps track of
 * subscribers interested in a specific change notification on an
 * observable source.
 *
 * @remarks
 * This set is optimized for the most common scenario of 1 or 2 subscribers.
 * With this in mind, it can store a subscriber in an internal field, allowing it to avoid Array#push operations.
 * If the set ever exceeds two subscribers, it upgrades to an array automatically.
 * @public
 */


class SubscriberSet {
  /**
   * Creates an instance of SubscriberSet for the specified source.
   * @param source - The object source that subscribers will receive notifications from.
   * @param initialSubscriber - An initial subscriber to changes.
   */
  constructor(source, initialSubscriber) {
    this.sub1 = void 0;
    this.sub2 = void 0;
    this.spillover = void 0;
    this.source = source;
    this.sub1 = initialSubscriber;
  }
  /**
   * Checks whether the provided subscriber has been added to this set.
   * @param subscriber - The subscriber to test for inclusion in this set.
   */


  has(subscriber) {
    return this.sub1 === subscriber || this.sub2 === subscriber;
  }
  /**
   * Subscribes to notification of changes in an object's state.
   * @param subscriber - The object that is subscribing for change notification.
   */


  subscribe(subscriber) {
    if (this.has(subscriber)) {
      return;
    }

    if (this.sub1 === void 0) {
      this.sub1 = subscriber;
      return;
    }

    if (this.sub2 === void 0) {
      this.sub2 = subscriber;
      return;
    }

    this.spillover = [this.sub1, this.sub2, subscriber];
    this.subscribe = spilloverSubscribe;
    this.unsubscribe = spilloverUnsubscribe;
    this.notify = spilloverNotifySubscribers;
    this.has = spilloverHas;
    this.sub1 = void 0;
    this.sub2 = void 0;
  }
  /**
   * Unsubscribes from notification of changes in an object's state.
   * @param subscriber - The object that is unsubscribing from change notification.
   */


  unsubscribe(subscriber) {
    if (this.sub1 === subscriber) {
      this.sub1 = void 0;
    } else if (this.sub2 === subscriber) {
      this.sub2 = void 0;
    }
  }
  /**
   * Notifies all subscribers.
   * @param args - Data passed along to subscribers during notification.
   */


  notify(args) {
    const sub1 = this.sub1;
    const sub2 = this.sub2;
    const source = this.source;

    if (sub1 !== void 0) {
      sub1.handleChange(source, args);
    }

    if (sub2 !== void 0) {
      sub2.handleChange(source, args);
    }
  }

}
/**
 * An implementation of Notifier that allows subscribers to be notified
 * of individual property changes on an object.
 * @public
 */

class PropertyChangeNotifier {
  /**
   * Creates an instance of PropertyChangeNotifier for the specified source.
   * @param source - The object source that subscribers will receive notifications from.
   */
  constructor(source) {
    this.subscribers = {};
    this.source = source;
  }
  /**
   * Notifies all subscribers, based on the specified property.
   * @param propertyName - The property name, passed along to subscribers during notification.
   */


  notify(propertyName) {
    const subscribers = this.subscribers[propertyName];

    if (subscribers !== void 0) {
      subscribers.notify(propertyName);
    }
  }
  /**
   * Subscribes to notification of changes in an object's state.
   * @param subscriber - The object that is subscribing for change notification.
   * @param propertyToWatch - The name of the property that the subscriber is interested in watching for changes.
   */


  subscribe(subscriber, propertyToWatch) {
    let subscribers = this.subscribers[propertyToWatch];

    if (subscribers === void 0) {
      this.subscribers[propertyToWatch] = subscribers = new SubscriberSet(this.source);
    }

    subscribers.subscribe(subscriber);
  }
  /**
   * Unsubscribes from notification of changes in an object's state.
   * @param subscriber - The object that is unsubscribing from change notification.
   * @param propertyToUnwatch - The name of the property that the subscriber is no longer interested in watching.
   */


  unsubscribe(subscriber, propertyToUnwatch) {
    const subscribers = this.subscribers[propertyToUnwatch];

    if (subscribers === void 0) {
      return;
    }

    subscribers.unsubscribe(subscriber);
  }

}

const volatileRegex = /(\:|\&\&|\|\||if)/;
const notifierLookup = new WeakMap();
const accessorLookup = new WeakMap();
let watcher = void 0;

let createArrayObserver = array => {
  throw new Error("Must call enableArrayObservation before observing arrays.");
};

class DefaultObservableAccessor {
  constructor(name, target) {
    this.name = name;
    this.field = `_${name}`;
    this.callback = `${name}Changed`;
    this.hasCallback = this.callback in target;
  }

  getValue(source) {
    if (watcher !== void 0) {
      watcher.watch(source, this.name);
    }

    return source[this.field];
  }

  setValue(source, newValue) {
    const field = this.field;
    const oldValue = source[field];

    if (oldValue !== newValue) {
      source[field] = newValue;

      if (this.hasCallback) {
        source[this.callback](oldValue, newValue);
      }
      /* eslint-disable-next-line @typescript-eslint/no-use-before-define */


      getNotifier(source).notify(this.name);
    }
  }

}
/**
 * Common Observable APIs.
 * @public
 */


const Observable = Object.freeze({
  /**
   * @internal
   * @param factory - The factory used to create array observers.
   */
  setArrayObserverFactory(factory) {
    createArrayObserver = factory;
  },

  /**
   * Gets a notifier for an object or Array.
   * @param source - The object or Array to get the notifier for.
   */
  getNotifier(source) {
    let found = source.$fastController || notifierLookup.get(source);

    if (found === void 0) {
      if (Array.isArray(source)) {
        found = createArrayObserver(source);
      } else {
        notifierLookup.set(source, found = new PropertyChangeNotifier(source));
      }
    }

    return found;
  },

  /**
   * Records a property change for a source object.
   * @param source - The object to record the change against.
   * @param propertyName - The property to track as changed.
   */
  track(source, propertyName) {
    if (watcher !== void 0) {
      watcher.watch(source, propertyName);
    }
  },

  /**
   * Notifies watchers that the currently executing property getter or function is volatile
   * with respect to its observable dependencies.
   */
  trackVolatile() {
    if (watcher !== void 0) {
      watcher.needsRefresh = true;
    }
  },

  /**
   * Notifies subscribers of a source object of changes.
   * @param source - the object to notify of changes.
   * @param args - The change args to pass to subscribers.
   */
  notify(source, args) {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    getNotifier(source).notify(args);
  },

  /**
   * Defines an observable property on an object or prototype.
   * @param target - The target object to define the observable on.
   * @param nameOrAccessor - The name of the property to define as observable;
   * or a custom accessor that specifies the property name and accessor implementation.
   */
  defineProperty(target, nameOrAccessor) {
    if (typeof nameOrAccessor === "string") {
      nameOrAccessor = new DefaultObservableAccessor(nameOrAccessor, target);
    }

    this.getAccessors(target).push(nameOrAccessor);
    Reflect.defineProperty(target, nameOrAccessor.name, {
      enumerable: true,
      get: function () {
        return nameOrAccessor.getValue(this);
      },
      set: function (newValue) {
        nameOrAccessor.setValue(this, newValue);
      }
    });
  },

  /**
   * Finds all the observable accessors defined on the target,
   * including its prototype chain.
   * @param target - The target object to search for accessor on.
   */
  getAccessors(target) {
    let accessors = accessorLookup.get(target);

    if (accessors === void 0) {
      let currentTarget = Reflect.getPrototypeOf(target);

      while (accessors === void 0 && currentTarget !== null) {
        accessors = accessorLookup.get(currentTarget);
        currentTarget = Reflect.getPrototypeOf(currentTarget);
      }

      if (accessors === void 0) {
        accessors = [];
      } else {
        accessors = accessors.slice(0);
      }

      accessorLookup.set(target, accessors);
    }

    return accessors;
  },

  /**
   * Creates a {@link BindingObserver} that can watch the
   * provided {@link Binding} for changes.
   * @param binding - The binding to observe.
   * @param initialSubscriber - An initial subscriber to changes in the binding value.
   * @param isVolatileBinding - Indicates whether the binding's dependency list must be re-evaluated on every value evaluation.
   */
  binding(binding, initialSubscriber, isVolatileBinding = this.isVolatileBinding(binding)) {
    return new BindingObserverImplementation(binding, initialSubscriber, isVolatileBinding);
  },

  /**
   * Determines whether a binding expression is volatile and needs to have its dependency list re-evaluated
   * on every evaluation of the value.
   * @param binding - The binding to inspect.
   */
  isVolatileBinding(binding) {
    return volatileRegex.test(binding.toString());
  }

});
const getNotifier = Observable.getNotifier;
const trackVolatile = Observable.trackVolatile;
const queueUpdate = DOM.queueUpdate;
/**
 * Decorator: Defines an observable property on the target.
 * @param target - The target to define the observable on.
 * @param nameOrAccessor - The property name or accessor to define the observable as.
 * @public
 */

function observable(target, nameOrAccessor) {
  Observable.defineProperty(target, nameOrAccessor);
}
/**
 * Decorator: Marks a property getter as having volatile observable dependencies.
 * @param target - The target that the property is defined on.
 * @param name - The property name.
 * @param name - The existing descriptor.
 * @public
 */

function volatile(target, name, descriptor) {
  return Object.assign({}, descriptor, {
    get: function () {
      var _a;

      trackVolatile();
      return (_a = descriptor.get) === null || _a === void 0 ? void 0 : _a.apply(this);
    }
  });
}
let currentEvent = null;
/**
 * @param event - The event to set as current for the context.
 * @internal
 */

function setCurrentEvent(event) {
  currentEvent = event;
}
/**
 * Provides additional contextual information available to behaviors and expressions.
 * @public
 */

class ExecutionContext {
  constructor() {
    /**
     * The index of the current item within a repeat context.
     */
    this.index = 0;
    /**
     * The length of the current collection within a repeat context.
     */

    this.length = 0;
    /**
     * The parent data object within a repeat context.
     */

    this.parent = null;
  }
  /**
   * The current event within an event handler.
   */


  get event() {
    return currentEvent;
  }
  /**
   * Indicates whether the current item within a repeat context
   * has an even index.
   */


  get isEven() {
    return this.index % 2 === 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * has an odd index.
   */


  get isOdd() {
    return this.index % 2 !== 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is the first item in the collection.
   */


  get isFirst() {
    return this.index === 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is somewhere in the middle of the collection.
   */


  get isInMiddle() {
    return !this.isFirst && !this.isLast;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is the last item in the collection.
   */


  get isLast() {
    return this.index === this.length - 1;
  }

}
Observable.defineProperty(ExecutionContext.prototype, "index");
Observable.defineProperty(ExecutionContext.prototype, "length");
/**
 * The default execution context used in binding expressions.
 * @public
 */

const defaultExecutionContext = Object.seal(new ExecutionContext());

class BindingObserverImplementation extends SubscriberSet {
  constructor(binding, initialSubscriber, isVolatileBinding = false) {
    super(binding, initialSubscriber);
    this.binding = binding;
    this.isVolatileBinding = isVolatileBinding;
    this.needsRefresh = true;
    this.needsQueue = true;
    this.first = this;
    this.last = null;
    this.propertySource = void 0;
    this.propertyName = void 0;
    this.notifier = void 0;
    this.next = void 0;
  }

  observe(source, context) {
    if (this.needsRefresh && this.last !== null) {
      this.disconnect();
    }

    const previousWatcher = watcher;
    watcher = this.needsRefresh ? this : void 0;
    this.needsRefresh = this.isVolatileBinding;
    const result = this.binding(source, context);
    watcher = previousWatcher;
    return result;
  }

  disconnect() {
    if (this.last !== null) {
      let current = this.first;

      while (current !== void 0) {
        current.notifier.unsubscribe(this, current.propertyName);
        current = current.next;
      }

      this.last = null;
      this.needsRefresh = true;
    }
  }
  /** @internal */


  watch(propertySource, propertyName) {
    const prev = this.last;
    const notifier = getNotifier(propertySource);
    const current = prev === null ? this.first : {};
    current.propertySource = propertySource;
    current.propertyName = propertyName;
    current.notifier = notifier;
    notifier.subscribe(this, propertyName);

    if (prev !== null) {
      if (!this.needsRefresh) {
        watcher = void 0;
        const prevValue = prev.propertySource[prev.propertyName];
        watcher = this;

        if (propertySource === prevValue) {
          this.needsRefresh = true;
        }
      }

      prev.next = current;
    }

    this.last = current;
  }
  /** @internal */


  handleChange() {
    if (this.needsQueue) {
      this.needsQueue = false;
      queueUpdate(this);
    }
  }
  /** @internal */


  call() {
    if (this.last !== null) {
      this.needsQueue = true;
      this.notify(this);
    }
  }

}

/**
 * Instructs the template engine to apply behavior to a node.
 * @public
 */

class Directive {
  constructor() {
    /**
     * The index of the DOM node to which the created behavior will apply.
     */
    this.targetIndex = 0;
  }

}
/**
 * A directive that attaches special behavior to an element via a custom attribute.
 * @public
 */

class AttachedBehaviorDirective extends Directive {
  /**
   *
   * @param name - The name of the behavior; used as a custom attribute on the element.
   * @param behavior - The behavior to instantiate and attach to the element.
   * @param options - Options to pass to the behavior during creation.
   */
  constructor(name, behavior, options) {
    super();
    this.name = name;
    this.behavior = behavior;
    this.options = options;
  }
  /**
   * Creates a placeholder string based on the directive's index within the template.
   * @param index - The index of the directive within the template.
   * @remarks
   * Creates a custom attribute placeholder.
   */


  createPlaceholder(index) {
    return DOM.createCustomAttributePlaceholder(this.name, index);
  }
  /**
   * Creates a behavior for the provided target node.
   * @param target - The node instance to create the behavior for.
   * @remarks
   * Creates an instance of the `behavior` type this directive was constructed with
   * and passes the target and options to that `behavior`'s constructor.
   */


  createBehavior(target) {
    return new this.behavior(target, this.options);
  }

}

function normalBind(source, context) {
  this.source = source;
  this.context = context;

  if (this.bindingObserver === null) {
    this.bindingObserver = Observable.binding(this.binding, this, this.isBindingVolatile);
  }

  this.updateTarget(this.bindingObserver.observe(source, context));
}

function triggerBind(source, context) {
  this.source = source;
  this.context = context;
  this.target.addEventListener(this.targetName, this);
}

function normalUnbind() {
  this.bindingObserver.disconnect();
  this.source = null;
  this.context = null;
}

function contentUnbind() {
  this.bindingObserver.disconnect();
  this.source = null;
  this.context = null;
  const view = this.target.$fastView;

  if (view !== void 0 && view.isComposed) {
    view.unbind();
    view.needsBindOnly = true;
  }
}

function triggerUnbind() {
  this.target.removeEventListener(this.targetName, this);
  this.source = null;
  this.context = null;
}

function updateAttributeTarget(value) {
  DOM.setAttribute(this.target, this.targetName, value);
}

function updateBooleanAttributeTarget(value) {
  DOM.setBooleanAttribute(this.target, this.targetName, value);
}

function updateContentTarget(value) {
  // If there's no actual value, then this equates to the
  // empty string for the purposes of content bindings.
  if (value === null || value === undefined) {
    value = "";
  } // If the value has a "create" method, then it's a template-like.


  if (value.create) {
    this.target.textContent = "";
    let view = this.target.$fastView; // If there's no previous view that we might be able to
    // reuse then create a new view from the template.

    if (view === void 0) {
      view = value.create();
    } else {
      // If there is a previous view, but it wasn't created
      // from the same template as the new value, then we
      // need to remove the old view if it's still in the DOM
      // and create a new view from the template.
      if (this.target.$fastTemplate !== value) {
        if (view.isComposed) {
          view.remove();
          view.unbind();
        }

        view = value.create();
      }
    } // It's possible that the value is the same as the previous template
    // and that there's actually no need to compose it.


    if (!view.isComposed) {
      view.isComposed = true;
      view.bind(this.source, this.context);
      view.insertBefore(this.target);
      this.target.$fastView = view;
      this.target.$fastTemplate = value;
    } else if (view.needsBindOnly) {
      view.needsBindOnly = false;
      view.bind(this.source, this.context);
    }
  } else {
    const view = this.target.$fastView; // If there is a view and it's currently composed into
    // the DOM, then we need to remove it.

    if (view !== void 0 && view.isComposed) {
      view.isComposed = false;
      view.remove();

      if (view.needsBindOnly) {
        view.needsBindOnly = false;
      } else {
        view.unbind();
      }
    }

    this.target.textContent = value;
  }
}

function updatePropertyTarget(value) {
  this.target[this.targetName] = value;
}

function updateClassTarget(value) {
  const classVersions = this.classVersions || Object.create(null);
  const target = this.target;
  let version = this.version || 0; // Add the classes, tracking the version at which they were added.

  if (value !== null && value !== undefined && value.length) {
    const names = value.split(/\s+/);

    for (let i = 0, ii = names.length; i < ii; ++i) {
      const currentName = names[i];

      if (currentName === "") {
        continue;
      }

      classVersions[currentName] = version;
      target.classList.add(currentName);
    }
  }

  this.classVersions = classVersions;
  this.version = version + 1; // If this is the first call to add classes, there's no need to remove old ones.

  if (version === 0) {
    return;
  } // Remove classes from the previous version.


  version -= 1;

  for (const name in classVersions) {
    if (classVersions[name] === version) {
      target.classList.remove(name);
    }
  }
}
/**
 * A directive that configures data binding to element content and attributes.
 * @public
 */


class BindingDirective extends Directive {
  /**
   * Creates an instance of BindingDirective.
   * @param binding - A binding that returns the data used to update the DOM.
   */
  constructor(binding) {
    super();
    this.binding = binding;
    this.bind = normalBind;
    this.unbind = normalUnbind;
    this.updateTarget = updateAttributeTarget;
    /**
     * Creates a placeholder string based on the directive's index within the template.
     * @param index - The index of the directive within the template.
     */

    this.createPlaceholder = DOM.createInterpolationPlaceholder;
    this.isBindingVolatile = Observable.isVolatileBinding(this.bind);
  }
  /**
   * Gets/sets the name of the attribute or property that this
   * binding is targeting.
   */


  get targetName() {
    return this.originalTargetName;
  }

  set targetName(value) {
    this.originalTargetName = value;

    if (value === void 0) {
      return;
    }

    switch (value[0]) {
      case ":":
        this.cleanedTargetName = value.substr(1);
        this.updateTarget = updatePropertyTarget;

        if (this.cleanedTargetName === "innerHTML") {
          const binding = this.binding;
          /* eslint-disable-next-line */

          this.binding = (s, c) => DOM.createHTML(binding(s, c));
        }

        break;

      case "?":
        this.cleanedTargetName = value.substr(1);
        this.updateTarget = updateBooleanAttributeTarget;
        break;

      case "@":
        this.cleanedTargetName = value.substr(1);
        this.bind = triggerBind;
        this.unbind = triggerUnbind;
        break;

      default:
        this.cleanedTargetName = value;

        if (value === "class") {
          this.updateTarget = updateClassTarget;
        }

        break;
    }
  }
  /**
   * Makes this binding target the content of an element rather than
   * a particular attribute or property.
   */


  targetAtContent() {
    this.updateTarget = updateContentTarget;
    this.unbind = contentUnbind;
  }
  /**
   * Creates the runtime BindingBehavior instance based on the configuration
   * information stored in the BindingDirective.
   * @param target - The target node that the binding behavior should attach to.
   */


  createBehavior(target) {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    return new BindingBehavior(target, this.binding, this.isBindingVolatile, this.bind, this.unbind, this.updateTarget, this.cleanedTargetName);
  }

}
/**
 * A behavior that updates content and attributes based on a configured
 * BindingDirective.
 * @public
 */

class BindingBehavior {
  /**
   * Creates an instance of BindingBehavior.
   * @param target - The target of the data updates.
   * @param binding - The binding that returns the latest value for an update.
   * @param isBindingVolatile - Indicates whether the binding has volatile dependencies.
   * @param bind - The operation to perform during binding.
   * @param unbind - The operation to perform during unbinding.
   * @param updateTarget - The operation to perform when updating.
   * @param targetName - The name of the target attribute or property to update.
   */
  constructor(target, binding, isBindingVolatile, bind, unbind, updateTarget, targetName) {
    /** @internal */
    this.source = null;
    /** @internal */

    this.context = null;
    /** @internal */

    this.bindingObserver = null;
    this.target = target;
    this.binding = binding;
    this.isBindingVolatile = isBindingVolatile;
    this.bind = bind;
    this.unbind = unbind;
    this.updateTarget = updateTarget;
    this.targetName = targetName;
  }
  /** @internal */


  handleChange() {
    this.updateTarget(this.bindingObserver.observe(this.source, this.context));
  }
  /** @internal */


  handleEvent(event) {
    setCurrentEvent(event);
    const result = this.binding(this.source, this.context);
    setCurrentEvent(null);

    if (result !== true) {
      event.preventDefault();
    }
  }

}

const compilationContext = {
  locatedDirectives: 0,
  targetIndex: -1
};

function createAggregateBinding(parts) {
  if (parts.length === 1) {
    compilationContext.locatedDirectives++;
    return parts[0];
  }

  let targetName;
  const partCount = parts.length;
  const finalParts = parts.map(x => {
    if (typeof x === "string") {
      return () => x;
    }

    targetName = x.targetName || targetName;
    compilationContext.locatedDirectives++;
    return x.binding;
  });

  const binding = (scope, context) => {
    let output = "";

    for (let i = 0; i < partCount; ++i) {
      output += finalParts[i](scope, context);
    }

    return output;
  };

  const directive = new BindingDirective(binding);
  directive.targetName = targetName;
  return directive;
}

const interpolationEndLength = _interpolationEnd.length;

function parseContent(value, directives) {
  const valueParts = value.split(_interpolationStart);

  if (valueParts.length === 1) {
    return null;
  }

  const bindingParts = [];

  for (let i = 0, ii = valueParts.length; i < ii; ++i) {
    const current = valueParts[i];
    const index = current.indexOf(_interpolationEnd);
    let literal;

    if (index === -1) {
      literal = current;
    } else {
      const directiveIndex = parseInt(current.substring(0, index));
      bindingParts.push(directives[directiveIndex]);
      literal = current.substring(index + interpolationEndLength);
    }

    if (literal !== "") {
      bindingParts.push(literal);
    }
  }

  return bindingParts;
}

function compileAttributes(node, directives, factories, includeBasicValues = false) {
  const attributes = node.attributes;

  for (let i = 0, ii = attributes.length; i < ii; ++i) {
    const attr = attributes[i];
    const attrValue = attr.value;
    const parseResult = parseContent(attrValue, directives);
    let result = null;

    if (parseResult === null) {
      if (includeBasicValues) {
        result = new BindingDirective(() => attrValue);
        result.targetName = attr.name;
      }
    } else {
      result = createAggregateBinding(parseResult);
    }

    if (result !== null) {
      node.removeAttributeNode(attr);
      i--;
      ii--;
      result.targetIndex = compilationContext.targetIndex;
      factories.push(result);
    }
  }
}

function captureContentBinding(directive, viewBehaviorFactories) {
  directive.targetAtContent();
  directive.targetIndex = compilationContext.targetIndex;
  viewBehaviorFactories.push(directive);
  compilationContext.locatedDirectives++;
}

function compileContent(node, directives, factories, walker) {
  const parseResult = parseContent(node.textContent, directives);

  if (parseResult !== null) {
    let lastNode = node;

    for (let i = 0, ii = parseResult.length; i < ii; ++i) {
      const currentPart = parseResult[i];
      const currentNode = i === 0 ? node : lastNode.parentNode.insertBefore(document.createTextNode(""), lastNode.nextSibling);

      if (typeof currentPart === "string") {
        currentNode.textContent = currentPart;
      } else {
        currentNode.textContent = " ";
        captureContentBinding(currentPart, factories);
      }

      lastNode = currentNode;
      compilationContext.targetIndex++;

      if (currentNode !== node) {
        walker.nextNode();
      }
    }

    compilationContext.targetIndex--;
  }
}
/**
 * Compiles a template and associated directives into a raw compilation
 * result which include a cloneable DocumentFragment and factories capable
 * of attaching runtime behavior to nodes within the fragment.
 * @param template - The template to compile.
 * @param directives - The directives referenced by the template.
 * @remarks
 * The template that is provided for compilation is altered in-place
 * and cannot be compiled again. If the original template must be preserved,
 * it is recommended that you clone the original and pass the clone to this API.
 * @public
 */


function compileTemplate(template, directives) {
  const hostBehaviorFactories = [];
  compilationContext.locatedDirectives = 0;
  compileAttributes(template, directives, hostBehaviorFactories, true);
  const fragment = template.content;
  const viewBehaviorFactories = [];
  const directiveCount = directives.length;
  const walker = document.createTreeWalker(fragment, 133, // element, text, comment
  null, false);
  compilationContext.targetIndex = -1;

  while (compilationContext.locatedDirectives < directiveCount) {
    const node = walker.nextNode();

    if (node === null) {
      break;
    }

    compilationContext.targetIndex++;

    switch (node.nodeType) {
      case 1:
        // element node
        compileAttributes(node, directives, viewBehaviorFactories);
        break;

      case 3:
        // text node
        compileContent(node, directives, viewBehaviorFactories, walker);
        break;

      case 8:
        // comment
        if (DOM.isMarker(node)) {
          const directive = directives[DOM.extractDirectiveIndexFromMarker(node)];
          directive.targetIndex = compilationContext.targetIndex;
          compilationContext.locatedDirectives++;
          viewBehaviorFactories.push(directive);
        } else {
          node.parentNode.removeChild(node);
          compilationContext.targetIndex--;
        }

    }
  }

  let targetOffset = 0;

  if (DOM.isMarker(fragment.firstChild)) {
    // If the first node in a fragment is a marker, that means it's an unstable first node,
    // because something like a when, repeat, etc. could add nodes before the marker.
    // To mitigate this, we insert a stable first node. However, if we insert a node,
    // that will alter the result of the TreeWalker. So, we also need to offset the target index.
    fragment.insertBefore(document.createComment(""), fragment.firstChild);
    targetOffset = -1;
  }

  return {
    fragment,
    viewBehaviorFactories,
    hostBehaviorFactories,
    targetOffset
  };
}

// A singleton Range instance used to efficiently remove ranges of DOM nodes.
// See the implementation of HTMLView below for further details.
const range = document.createRange();
/**
 * The standard View implementation, which also implements ElementView and SyntheticView.
 * @public
 */

class HTMLView {
  /**
   * Constructs an instance of HTMLView.
   * @param fragment - The html fragment that contains the nodes for this view.
   * @param behaviors - The behaviors to be applied to this view.
   */
  constructor(fragment, behaviors) {
    this.fragment = fragment;
    this.behaviors = behaviors;
    /**
     * The data that the view is bound to.
     */

    this.source = null;
    /**
     * The execution context the view is running within.
     */

    this.context = null;
    this.firstChild = fragment.firstChild;
    this.lastChild = fragment.lastChild;
  }
  /**
   * Appends the view's DOM nodes to the referenced node.
   * @param node - The parent node to append the view's DOM nodes to.
   */


  appendTo(node) {
    node.appendChild(this.fragment);
  }
  /**
   * Inserts the view's DOM nodes before the referenced node.
   * @param node - The node to insert the view's DOM before.
   */


  insertBefore(node) {
    if (this.fragment.hasChildNodes()) {
      node.parentNode.insertBefore(this.fragment, node);
    } else {
      const parentNode = node.parentNode;
      const end = this.lastChild;
      let current = this.firstChild;
      let next;

      while (current !== end) {
        next = current.nextSibling;
        parentNode.insertBefore(current, node);
        current = next;
      }

      parentNode.insertBefore(end, node);
    }
  }
  /**
   * Removes the view's DOM nodes.
   * The nodes are not disposed and the view can later be re-inserted.
   */


  remove() {
    const fragment = this.fragment;
    const end = this.lastChild;
    let current = this.firstChild;
    let next;

    while (current !== end) {
      next = current.nextSibling;
      fragment.appendChild(current);
      current = next;
    }

    fragment.appendChild(end);
  }
  /**
   * Removes the view and unbinds its behaviors, disposing of DOM nodes afterward.
   * Once a view has been disposed, it cannot be inserted or bound again.
   */


  dispose() {
    const parent = this.firstChild.parentNode;
    const end = this.lastChild;
    let current = this.firstChild;
    let next;

    while (current !== end) {
      next = current.nextSibling;
      parent.removeChild(current);
      current = next;
    }

    parent.removeChild(end);
    const behaviors = this.behaviors;
    const oldSource = this.source;

    for (let i = 0, ii = behaviors.length; i < ii; ++i) {
      behaviors[i].unbind(oldSource);
    }
  }
  /**
   * Binds a view's behaviors to its binding source.
   * @param source - The binding source for the view's binding behaviors.
   * @param context - The execution context to run the behaviors within.
   */


  bind(source, context) {
    const behaviors = this.behaviors;

    if (this.source === source) {
      return;
    } else if (this.source !== null) {
      const oldSource = this.source;
      this.source = source;
      this.context = context;

      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        const current = behaviors[i];
        current.unbind(oldSource);
        current.bind(source, context);
      }
    } else {
      this.source = source;
      this.context = context;

      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        behaviors[i].bind(source, context);
      }
    }
  }
  /**
   * Unbinds a view's behaviors from its binding source.
   */


  unbind() {
    if (this.source === null) {
      return;
    }

    const behaviors = this.behaviors;
    const oldSource = this.source;

    for (let i = 0, ii = behaviors.length; i < ii; ++i) {
      behaviors[i].unbind(oldSource);
    }

    this.source = null;
  }
  /**
   * Efficiently disposes of a contiguous range of synthetic view instances.
   * @param views - A contiguous range of views to be disposed.
   */


  static disposeContiguousBatch(views) {
    if (views.length === 0) {
      return;
    } // Get the first node of the first view in the range.


    range.setStart(views[0].firstChild, 0); // Get the last node of the last view in the range. Then go one further
    // because the deleteContents operation isn't inclusive of the end node.
    // In all cases where we use this API, the node after the last node of
    // the last view is the comment node that we use as a placeholder.

    range.setEnd(views[views.length - 1].lastChild.nextSibling, 0);
    range.deleteContents();

    for (let i = 0, ii = views.length; i < ii; ++i) {
      const view = views[i];
      const behaviors = view.behaviors;
      const oldSource = view.source;

      for (let j = 0, jj = behaviors.length; j < jj; ++j) {
        behaviors[j].unbind(oldSource);
      }
    }
  }

}

/**
 * A template capable of creating HTMLView instances or rendering directly to DOM.
 * @public
 */

class ViewTemplate {
  /**
   * Creates an instance of ViewTemplate.
   * @param html - The html representing what this template will instantiate, including placeholders for directives.
   * @param directives - The directives that will be connected to placeholders in the html.
   */
  constructor(html, directives) {
    this.behaviorCount = 0;
    this.hasHostBehaviors = false;
    this.fragment = null;
    this.targetOffset = 0;
    this.viewBehaviorFactories = null;
    this.hostBehaviorFactories = null;
    this.html = html;
    this.directives = directives;
  }
  /**
   * Creates an HTMLView instance based on this template definition.
   * @param host - The host element that this template will be rendered to once created.
   */


  create(host) {
    if (this.fragment === null) {
      let template;
      const html = this.html;

      if (typeof html === "string") {
        template = document.createElement("template");
        template.innerHTML = DOM.createHTML(html);
        const fec = template.content.firstElementChild;

        if (fec !== null && fec.tagName === "TEMPLATE") {
          template = fec;
        }
      } else {
        template = html;
      }

      const result = compileTemplate(template, this.directives);
      this.fragment = result.fragment;
      this.viewBehaviorFactories = result.viewBehaviorFactories;
      this.hostBehaviorFactories = result.hostBehaviorFactories;
      this.targetOffset = result.targetOffset;
      this.behaviorCount = this.viewBehaviorFactories.length + this.hostBehaviorFactories.length;
      this.hasHostBehaviors = this.hostBehaviorFactories.length > 0;
    }

    const fragment = this.fragment.cloneNode(true);
    const viewFactories = this.viewBehaviorFactories;
    const behaviors = new Array(this.behaviorCount);
    const walker = document.createTreeWalker(fragment, 133, // element, text, comment
    null, false);
    let behaviorIndex = 0;
    let targetIndex = this.targetOffset;
    let node = walker.nextNode();

    for (let ii = viewFactories.length; behaviorIndex < ii; ++behaviorIndex) {
      const factory = viewFactories[behaviorIndex];
      const factoryIndex = factory.targetIndex;

      while (node !== null) {
        if (targetIndex === factoryIndex) {
          behaviors[behaviorIndex] = factory.createBehavior(node);
          break;
        } else {
          node = walker.nextNode();
          targetIndex++;
        }
      }
    }

    if (this.hasHostBehaviors) {
      const hostFactories = this.hostBehaviorFactories;

      for (let i = 0, ii = hostFactories.length; i < ii; ++i, ++behaviorIndex) {
        behaviors[behaviorIndex] = hostFactories[i].createBehavior(host);
      }
    }

    return new HTMLView(fragment, behaviors);
  }
  /**
   * Creates an HTMLView from this template, binds it to the source, and then appends it to the host.
   * @param source - The data source to bind the template to.
   * @param host - The HTMLElement where the template will be rendered.
   */


  render(source, host) {
    if (typeof host === "string") {
      host = document.getElementById(host);
    }

    const view = this.create(host);
    view.bind(source, defaultExecutionContext);
    view.appendTo(host);
    return view;
  }

} // Much thanks to LitHTML for working this out!

const lastAttributeNameRegex = // eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;
/**
 * Transforms a template literal string into a renderable ViewTemplate.
 * @param strings - The string fragments that are interpolated with the values.
 * @param values - The values that are interpolated with the string fragments.
 * @remarks
 * The html helper supports interpolation of strings, numbers, binding expressions,
 * other template instances, and Directive instances.
 * @public
 */

function html(strings, ...values) {
  const directives = [];
  let html = "";

  for (let i = 0, ii = strings.length - 1; i < ii; ++i) {
    const currentString = strings[i];
    let value = values[i];
    html += currentString;

    if (value instanceof ViewTemplate) {
      const template = value;

      value = () => template;
    }

    if (typeof value === "function") {
      value = new BindingDirective(value);
      const match = lastAttributeNameRegex.exec(currentString);

      if (match !== null) {
        value.targetName = match[2];
      }
    }

    if (value instanceof Directive) {
      // Since not all values are directives, we can't use i
      // as the index for the placeholder. Instead, we need to
      // use directives.length to get the next index.
      html += value.createPlaceholder(directives.length);
      directives.push(value);
    } else {
      html += value;
    }
  }

  html += strings[strings.length - 1];
  return new ViewTemplate(html, directives);
}

/**
 * A {@link ValueConverter} that converts to and from `boolean` values.
 * @remarks
 * Used automatically when the `boolean` {@link AttributeMode} is selected.
 * @public
 */

const booleanConverter = {
  toView(value) {
    return value ? "true" : "false";
  },

  fromView(value) {
    if (value === null || value === void 0 || value === "false" || value === false || value === 0) {
      return false;
    }

    return true;
  }

};
/**
 * A {@link ValueConverter} that converts to and from `number` values.
 * @remarks
 * This converter allows for nullable numbers, returning `null` if the
 * input was `null`, `undefined`, or `NaN`.
 * @public
 */

const nullableNumberConverter = {
  toView(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const number = value * 1;
    return isNaN(number) ? null : number.toString();
  },

  fromView(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const number = value * 1;
    return isNaN(number) ? null : number;
  }

};
/**
 * An implementation of {@link Accessor} that supports reactivity,
 * change callbacks, attribute reflection, and type conversion for
 * custom elements.
 * @public
 */

class AttributeDefinition {
  /**
   * Creates an instance of AttributeDefinition.
   * @param Owner - The class constructor that owns this attribute.
   * @param name - The name of the property associated with the attribute.
   * @param attribute - The name of the attribute in HTML.
   * @param mode - The {@link AttributeMode} that describes the behavior of this attribute.
   * @param converter - A {@link ValueConverter} that integrates with the property getter/setter
   * to convert values to and from a DOM string.
   */
  constructor(Owner, name, attribute = name.toLowerCase(), mode = "reflect", converter) {
    this.guards = new Set();
    this.Owner = Owner;
    this.name = name;
    this.attribute = attribute;
    this.mode = mode;
    this.converter = converter;
    this.fieldName = `_${name}`;
    this.callbackName = `${name}Changed`;
    this.hasCallback = this.callbackName in Owner.prototype;

    if (mode === "boolean" && converter === void 0) {
      this.converter = booleanConverter;
    }
  }
  /**
   * Sets the value of the attribute/property on the source element.
   * @param source - The source element to access.
   * @param value - The value to set the attribute/property to.
   */


  setValue(source, newValue) {
    const oldValue = source[this.fieldName];
    const converter = this.converter;

    if (converter !== void 0) {
      newValue = converter.fromView(newValue);
    }

    if (oldValue !== newValue) {
      source[this.fieldName] = newValue;
      this.tryReflectToAttribute(source);

      if (this.hasCallback) {
        source[this.callbackName](oldValue, newValue);
      }

      source.$fastController.notify(this.name);
    }
  }
  /**
   * Gets the value of the attribute/property on the source element.
   * @param source - The source element to access.
   */


  getValue(source) {
    Observable.track(source, this.name);
    return source[this.fieldName];
  }
  /** @internal */


  onAttributeChangedCallback(element, value) {
    if (this.guards.has(element)) {
      return;
    }

    this.guards.add(element);
    this.setValue(element, value);
    this.guards.delete(element);
  }

  tryReflectToAttribute(element) {
    const mode = this.mode;
    const guards = this.guards;

    if (guards.has(element) || mode === "fromView") {
      return;
    }

    DOM.queueUpdate(() => {
      guards.add(element);
      const latestValue = element[this.fieldName];

      switch (mode) {
        case "reflect":
          const converter = this.converter;
          DOM.setAttribute(element, this.attribute, converter !== void 0 ? converter.toView(latestValue) : latestValue);
          break;

        case "boolean":
          DOM.setBooleanAttribute(element, this.attribute, latestValue);
          break;
      }

      guards.delete(element);
    });
  }
  /**
   * Collects all attribute definitions associated with the owner.
   * @param Owner - The class constructor to collect attribute for.
   * @param attributeLists - Any existing attributes to collect and merge with those associated with the owner.
   * @internal
   */


  static collect(Owner, ...attributeLists) {
    const attributes = [];
    attributeLists.push(Owner.attributes);

    for (let i = 0, ii = attributeLists.length; i < ii; ++i) {
      const list = attributeLists[i];

      if (list === void 0) {
        continue;
      }

      for (let j = 0, jj = list.length; j < jj; ++j) {
        const config = list[j];

        if (typeof config === "string") {
          attributes.push(new AttributeDefinition(Owner, config));
        } else {
          attributes.push(new AttributeDefinition(Owner, config.property, config.attribute, config.mode, config.converter));
        }
      }
    }

    return attributes;
  }

}
function attr(configOrTarget, prop) {
  let config;

  function decorator($target, $prop) {
    if (arguments.length > 1) {
      // Non invocation:
      // - @attr
      // Invocation with or w/o opts:
      // - @attr()
      // - @attr({...opts})
      config.property = $prop;
    }

    const attributes = $target.constructor.attributes || ($target.constructor.attributes = []);
    attributes.push(config);
  }

  if (arguments.length > 1) {
    // Non invocation:
    // - @attr
    config = {};
    decorator(configOrTarget, prop);
    return;
  } // Invocation with or w/o opts:
  // - @attr()
  // - @attr({...opts})


  config = configOrTarget === void 0 ? {} : configOrTarget;
  return decorator;
}

const styleLookup = new Map();
/**
 * Represents styles that can be applied to a custom element.
 * @public
 */

class ElementStyles {
  constructor() {
    /** @internal */
    this.behaviors = null;
  }
  /**
   * Associates behaviors with this set of styles.
   * @param behaviors - The behaviors to associate.
   */


  withBehaviors(...behaviors) {
    this.behaviors = this.behaviors === null ? behaviors : this.behaviors.concat(behaviors);
    return this;
  }
  /**
   * Adds these styles to a global cache for easy lookup by a known key.
   * @param key - The key to use for lookup and retrieval in the cache.
   */


  withKey(key) {
    styleLookup.set(key, this);
    return this;
  }
  /**
   * Attempts to find cached styles by a known key.
   * @param key - The key to search the style cache for.
   */


  static find(key) {
    return styleLookup.get(key) || null;
  }

}

function reduceStyles(styles) {
  return styles.map(x => x instanceof ElementStyles ? reduceStyles(x.styles) : [x]).reduce((prev, curr) => prev.concat(curr), []);
}

function reduceBehaviors(styles) {
  return styles.map(x => x instanceof ElementStyles ? x.behaviors : null).reduce((prev, curr) => {
    if (curr === null) {
      return prev;
    }

    if (prev === null) {
      prev = [];
    }

    return prev.concat(curr);
  }, null);
}
/**
 * https://wicg.github.io/construct-stylesheets/
 * https://developers.google.com/web/updates/2019/02/constructable-stylesheets
 *
 * @internal
 */


class AdoptedStyleSheetsStyles extends ElementStyles {
  constructor(styles, styleSheetCache) {
    super();
    this.styles = styles;
    this.behaviors = null;
    this.behaviors = reduceBehaviors(styles);
    this.styleSheets = reduceStyles(styles).map(x => {
      if (x instanceof CSSStyleSheet) {
        return x;
      }

      let sheet = styleSheetCache.get(x);

      if (sheet === void 0) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(x);
        styleSheetCache.set(x, sheet);
      }

      return sheet;
    });
  }

  addStylesTo(target) {
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, ...this.styleSheets];
  }

  removeStylesFrom(target) {
    const sourceSheets = this.styleSheets;
    target.adoptedStyleSheets = target.adoptedStyleSheets.filter(x => sourceSheets.indexOf(x) === -1);
  }

}
let styleClassId = 0;

function getNextStyleClass() {
  return `fast-style-class-${++styleClassId}`;
}
/**
 * @internal
 */


class StyleElementStyles extends ElementStyles {
  constructor(styles) {
    super();
    this.styles = styles;
    this.behaviors = null;
    this.behaviors = reduceBehaviors(styles);
    this.styleSheets = reduceStyles(styles);
    this.styleClass = getNextStyleClass();
  }

  addStylesTo(target) {
    const styleSheets = this.styleSheets;
    const styleClass = this.styleClass;

    if (target === document) {
      target = document.body;
    }

    for (let i = styleSheets.length - 1; i > -1; --i) {
      const element = document.createElement("style");
      element.innerHTML = styleSheets[i];
      element.className = styleClass;
      target.prepend(element);
    }
  }

  removeStylesFrom(target) {
    if (target === document) {
      target = document.body;
    }

    const styles = target.querySelectorAll(`.${this.styleClass}`);

    for (let i = 0, ii = styles.length; i < ii; ++i) {
      target.removeChild(styles[i]);
    }
  }

}
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const createStyles = (() => {
  if (DOM.supportsAdoptedStyleSheets) {
    const styleSheetCache = new Map();
    return styles => new AdoptedStyleSheetsStyles(styles, styleSheetCache);
  }

  return styles => new StyleElementStyles(styles);
})();
/* eslint-enable @typescript-eslint/explicit-function-return-type */

/**
 * Transforms a template literal string into styles.
 * @param strings - The string fragments that are interpolated with the values.
 * @param values - The values that are interpolated with the string fragments.
 * @remarks
 * The css helper supports interpolation of strings and ElementStyle instances.
 * @public
 */


function css(strings, ...values) {
  const styles = [];
  let cssString = "";

  for (let i = 0, ii = strings.length - 1; i < ii; ++i) {
    cssString += strings[i];
    const value = values[i];

    if (value instanceof ElementStyles || value instanceof CSSStyleSheet) {
      if (cssString.trim() !== "") {
        styles.push(cssString);
        cssString = "";
      }

      styles.push(value);
    } else {
      cssString += value;
    }
  }

  cssString += strings[strings.length - 1];

  if (cssString.trim() !== "") {
    styles.push(cssString);
  }

  return createStyles(styles);
}

/**
 * Defines metadata for a FASTElement.
 * @public
 */

class FASTElementDefinition {
  /**
   * Creates an instance of FASTElementDefinition.
   * @param name - The name of the custom element.
   * @param attributes - The custom attributes of the custom element.
   * @param propertyLookup - A map enabling lookup of attribute by associated property name.
   * @param attributeLookup - A map enabling lookup of property by associated attribute name.
   * @param template - The template to render for the custom element.
   * @param styles - The styles to associated with the custom element.
   * @param shadowOptions - Options controlling the creation of the custom element's shadow DOM.
   * @param elementOptions - Options controlling how the custom element is defined with the platform.
   */
  constructor(name, attributes, propertyLookup, attributeLookup, template, styles, shadowOptions, elementOptions) {
    this.name = name;
    this.attributes = attributes;
    this.propertyLookup = propertyLookup;
    this.attributeLookup = attributeLookup;
    this.template = template;
    this.shadowOptions = shadowOptions;
    this.elementOptions = elementOptions;
    this.styles = styles !== void 0 && !(styles instanceof ElementStyles) ? css` ${styles} ` : styles;
  }

}
/** @internal */

const fastDefinitions = new Map();

const defaultEventOptions = {
  bubbles: true,
  composed: true
};
/**
 * Controls the lifecycle and rendering of a `FASTElement`.
 * @public
 */

class Controller extends PropertyChangeNotifier {
  /**
   * Creates a Controller to control the specified element.
   * @param element - The element to be controlled by this controller.
   * @param definition - The element definition metadata that instructs this
   * controller in how to handle rendering and other platform integrations.
   * @internal
   */
  constructor(element, definition) {
    super(element);
    this.boundObservables = null;
    this.behaviors = null;
    /**
     * The view associated with the custom element.
     * @remarks
     * If `null` then the element is managing its own rendering.
     */

    this.view = null;
    /**
     * Indicates whether or not the custom element has been
     * connected to the document.
     */

    this.isConnected = false;
    this.element = element;
    this.definition = definition;
    const template = definition.template;
    const styles = definition.styles;
    const shadowRoot = definition.shadowOptions === void 0 ? void 0 : element.attachShadow(definition.shadowOptions);

    if (template !== void 0) {
      const view = this.view = template.create(this.element);

      if (shadowRoot === void 0) {
        view.appendTo(element);
      } else {
        view.appendTo(shadowRoot);
      }
    }

    if (styles !== void 0) {
      this.addStyles(styles, shadowRoot);
    } // Capture any observable values that were set by the binding engine before
    // the browser upgraded the element. Then delete the property since it will
    // shadow the getter/setter that is required to make the observable operate.
    // Later, in the connect callback, we'll re-apply the values.


    const accessors = Observable.getAccessors(element);

    if (accessors.length > 0) {
      const boundObservables = this.boundObservables = Object.create(null);

      for (let i = 0, ii = accessors.length; i < ii; ++i) {
        const propertyName = accessors[i].name;
        const value = element[propertyName];

        if (value !== void 0) {
          delete element[propertyName];
          boundObservables[propertyName] = value;
        }
      }
    }
  }
  /**
   * Adds styles to this element.
   * @param styles - The styles to add.
   */


  addStyles(styles,
  /** @internal */
  target = this.element.shadowRoot) {
    if (target !== null) {
      styles.addStylesTo(target);
    }

    const sourceBehaviors = styles.behaviors;

    if (sourceBehaviors !== null) {
      this.addBehaviors(sourceBehaviors);
    }
  }
  /**
   * Removes styles from this element.
   * @param styles - the styles to remove.
   */


  removeStyles(styles) {
    const target = this.element.shadowRoot;

    if (target !== null) {
      styles.removeStylesFrom(target);
    }

    const sourceBehaviors = styles.behaviors;

    if (sourceBehaviors !== null) {
      this.removeBehaviors(sourceBehaviors);
    }
  }
  /**
   * Adds behaviors to this element.
   * @param behaviors - The behaviors to add.
   */


  addBehaviors(behaviors) {
    const targetBehaviors = this.behaviors || (this.behaviors = []);
    const length = behaviors.length;

    for (let i = 0; i < length; ++i) {
      targetBehaviors.push(behaviors[i]);
    }

    if (this.isConnected) {
      const element = this.element;

      for (let i = 0; i < length; ++i) {
        behaviors[i].bind(element, defaultExecutionContext);
      }
    }
  }
  /**
   * Removes behaviors from this element.
   * @param behaviors - The behaviors to remove.
   */


  removeBehaviors(behaviors) {
    const targetBehaviors = this.behaviors;

    if (targetBehaviors === null) {
      return;
    }

    const length = behaviors.length;

    for (let i = 0; i < length; ++i) {
      const index = targetBehaviors.indexOf(behaviors[i]);

      if (index !== -1) {
        targetBehaviors.splice(index, 1);
      }
    }

    if (this.isConnected) {
      const element = this.element;

      for (let i = 0; i < length; ++i) {
        behaviors[i].unbind(element);
      }
    }
  }
  /**
   * Runs connected lifecycle behavior on the associated element.
   */


  onConnectedCallback() {
    if (this.isConnected) {
      return;
    }

    const element = this.element;
    const boundObservables = this.boundObservables; // If we have any observables that were bound, re-apply their values.

    if (boundObservables !== null) {
      const propertyNames = Object.keys(boundObservables);

      for (let i = 0, ii = propertyNames.length; i < ii; ++i) {
        const propertyName = propertyNames[i];
        element[propertyName] = boundObservables[propertyName];
      }

      this.boundObservables = null;
    }

    const view = this.view;

    if (view !== null) {
      view.bind(element, defaultExecutionContext);
    }

    const behaviors = this.behaviors;

    if (behaviors !== null) {
      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        behaviors[i].bind(element, defaultExecutionContext);
      }
    }

    this.isConnected = true;
  }
  /**
   * Runs disconnected lifecycle behavior on the associated element.
   */


  onDisconnectedCallback() {
    if (this.isConnected === false) {
      return;
    }

    this.isConnected = false;
    const view = this.view;

    if (view !== null) {
      view.unbind();
    }

    const behaviors = this.behaviors;

    if (behaviors !== null) {
      const element = this.element;

      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        behaviors[i].unbind(element);
      }
    }
  }
  /**
   * Runs the attribute changed callback for the associated element.
   * @param name - The name of the attribute that changed.
   * @param oldValue - The previous value of the attribute.
   * @param newValue - The new value of the attribute.
   */


  onAttributeChangedCallback(name, oldValue, newValue) {
    const attrDef = this.definition.attributeLookup[name];

    if (attrDef !== void 0) {
      attrDef.onAttributeChangedCallback(this.element, newValue);
    }
  }
  /**
   * Emits a custom HTML event.
   * @param type - The type name of the event.
   * @param detail - The event detail object to send with the event.
   * @param options - The event options. By default bubbles and composed.
   * @remarks
   * Only emits events if connected.
   */


  emit(type, detail, options) {
    if (this.isConnected) {
      return this.element.dispatchEvent(new CustomEvent(type, Object.assign(Object.assign({
        detail
      }, defaultEventOptions), options)));
    }

    return false;
  }
  /**
   * Locates or creates a controller for the specified element.
   * @param element - The element to return the controller for.
   * @remarks
   * The specified element must have a {@link FASTElementDefinition}
   * registered either through the use of the {@link customElement}
   * decorator or a call to `FASTElement.define`.
   */


  static forCustomElement(element) {
    const controller = element.$fastController;

    if (controller !== void 0) {
      return controller;
    }

    const definition = fastDefinitions.get(element.constructor);

    if (definition === void 0) {
      throw new Error("Missing FASTElement definition.");
    }

    return element.$fastController = new Controller(element, definition);
  }

}

const defaultShadowOptions = {
  mode: "open"
};
const defaultElementOptions = {};
/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */

function createFASTElement(BaseType) {
  return class extends BaseType {
    constructor() {
      /* eslint-disable-next-line */
      super();
      Controller.forCustomElement(this);
    }

    $emit(type, detail, options) {
      return this.$fastController.emit(type, detail, options);
    }

    connectedCallback() {
      this.$fastController.onConnectedCallback();
    }

    disconnectedCallback() {
      this.$fastController.onDisconnectedCallback();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      this.$fastController.onAttributeChangedCallback(name, oldValue, newValue);
    }

  };
}
/**
 * A minimal base class for FASTElements that also provides
 * static helpers for working with FASTElements.
 * @public
 */


const FASTElement = Object.assign(createFASTElement(HTMLElement), {
  /**
   * Creates a new FASTElement base class inherited from the
   * provided base type.
   * @param BaseType - The base element type to inherit from.
   */
  from(BaseType) {
    return createFASTElement(BaseType);
  },

  /**
   * Defines a platform custom element based on the provided type and definition.
   * @param Type - The custom element type to define.
   * @param nameOrDef - The name of the element to define or a definition object
   * that describes the element to define.
   */
  define(Type, nameOrDef = Type.definition) {
    if (typeof nameOrDef === "string") {
      nameOrDef = {
        name: nameOrDef
      };
    }

    const name = nameOrDef.name;
    const attributes = AttributeDefinition.collect(Type, nameOrDef.attributes);
    const shadowOptions = nameOrDef.shadowOptions === void 0 ? defaultShadowOptions : nameOrDef.shadowOptions === null ? void 0 : Object.assign(Object.assign({}, defaultShadowOptions), nameOrDef.shadowOptions);
    const elementOptions = nameOrDef.elementOptions === void 0 ? defaultElementOptions : Object.assign(Object.assign({}, defaultElementOptions), nameOrDef.shadowOptions);
    const observedAttributes = new Array(attributes.length);
    const proto = Type.prototype;
    const propertyLookup = {};
    const attributeLookup = {};

    for (let i = 0, ii = attributes.length; i < ii; ++i) {
      const current = attributes[i];
      observedAttributes[i] = current.attribute;
      propertyLookup[current.name] = current;
      attributeLookup[current.attribute] = current;
      Observable.defineProperty(proto, current);
    }

    Reflect.defineProperty(Type, "observedAttributes", {
      value: observedAttributes,
      enumerable: true
    });
    const definition = new FASTElementDefinition(name, attributes, propertyLookup, attributeLookup, nameOrDef.template, nameOrDef.styles, shadowOptions, elementOptions);
    fastDefinitions.set(Type, definition);
    customElements.define(name, Type, definition.elementOptions);
    return Type;
  },

  /**
   * Gets the element definition associated with the specified type.
   * @param Type - The custom element type to retrieve the definition for.
   */
  getDefinition(Type) {
    return fastDefinitions.get(Type);
  }

});
/**
 * Decorator: Defines a platform custom element based on `FASTElement`.
 * @param nameOrDef - The name of the element to define or a definition object
 * that describes the element to define.
 * @public
 */

function customElement(nameOrDef) {
  /* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */
  return function (type) {
    FASTElement.define(type, nameOrDef);
  };
}

/**
 * A readonly, empty array.
 * @remarks
 * Typically returned by APIs that return arrays when there are
 * no actual items to return.
 * @internal
 */
const emptyArray = Object.freeze([]);

/**
 * The runtime behavior for template references.
 * @public
 */

class RefBehavior {
  /**
   * Creates an instance of RefBehavior.
   * @param target - The element to reference.
   * @param propertyName - The name of the property to assign the reference to.
   */
  constructor(target, propertyName) {
    this.target = target;
    this.propertyName = propertyName;
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source) {
    source[this.propertyName] = this.target;
  }
  /* eslint-disable-next-line @typescript-eslint/no-empty-function */

  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */


  unbind() {}

}
/**
 * A directive that observes the updates a property with a reference to the element.
 * @param propertyName - The name of the property to assign the reference to.
 * @public
 */

function ref(propertyName) {
  return new AttachedBehaviorDirective("fast-ref", RefBehavior, propertyName);
}

/**
 * A directive that enables basic conditional rendering in a template.
 * @param binding - The condition to test for rendering.
 * @param templateOrTemplateBinding - The template or a binding that gets
 * the template to render when the condition is true.
 * @public
 */
function when(binding, templateOrTemplateBinding) {
  const getTemplate = typeof templateOrTemplateBinding === "function" ? templateOrTemplateBinding : () => templateOrTemplateBinding;
  return (source, context) => binding(source, context) ? getTemplate(source, context) : null;
}

/** @internal */

function newSplice(index, removed, addedCount) {
  return {
    index: index,
    removed: removed,
    addedCount: addedCount
  };
}
const EDIT_LEAVE = 0;
const EDIT_UPDATE = 1;
const EDIT_ADD = 2;
const EDIT_DELETE = 3; // Note: This function is *based* on the computation of the Levenshtein
// "edit" distance. The one change is that "updates" are treated as two
// edits - not one. With Array splices, an update is really a delete
// followed by an add. By retaining this, we optimize for "keeping" the
// maximum array items in the original array. For example:
//
//   'xxxx123' -> '123yyyy'
//
// With 1-edit updates, the shortest path would be just to update all seven
// characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
// leaves the substring '123' intact.

function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
  // "Deletion" columns
  const rowCount = oldEnd - oldStart + 1;
  const columnCount = currentEnd - currentStart + 1;
  const distances = new Array(rowCount);
  let north;
  let west; // "Addition" rows. Initialize null column.

  for (let i = 0; i < rowCount; ++i) {
    distances[i] = new Array(columnCount);
    distances[i][0] = i;
  } // Initialize null row


  for (let j = 0; j < columnCount; ++j) {
    distances[0][j] = j;
  }

  for (let i = 1; i < rowCount; ++i) {
    for (let j = 1; j < columnCount; ++j) {
      if (current[currentStart + j - 1] === old[oldStart + i - 1]) {
        distances[i][j] = distances[i - 1][j - 1];
      } else {
        north = distances[i - 1][j] + 1;
        west = distances[i][j - 1] + 1;
        distances[i][j] = north < west ? north : west;
      }
    }
  }

  return distances;
} // This starts at the final weight, and walks "backward" by finding
// the minimum previous weight recursively until the origin of the weight
// matrix.


function spliceOperationsFromEditDistances(distances) {
  let i = distances.length - 1;
  let j = distances[0].length - 1;
  let current = distances[i][j];
  const edits = [];

  while (i > 0 || j > 0) {
    if (i === 0) {
      edits.push(EDIT_ADD);
      j--;
      continue;
    }

    if (j === 0) {
      edits.push(EDIT_DELETE);
      i--;
      continue;
    }

    const northWest = distances[i - 1][j - 1];
    const west = distances[i - 1][j];
    const north = distances[i][j - 1];
    let min;

    if (west < north) {
      min = west < northWest ? west : northWest;
    } else {
      min = north < northWest ? north : northWest;
    }

    if (min === northWest) {
      if (northWest === current) {
        edits.push(EDIT_LEAVE);
      } else {
        edits.push(EDIT_UPDATE);
        current = northWest;
      }

      i--;
      j--;
    } else if (min === west) {
      edits.push(EDIT_DELETE);
      i--;
      current = west;
    } else {
      edits.push(EDIT_ADD);
      j--;
      current = north;
    }
  }

  edits.reverse();
  return edits;
}

function sharedPrefix(current, old, searchLength) {
  for (let i = 0; i < searchLength; ++i) {
    if (current[i] !== old[i]) {
      return i;
    }
  }

  return searchLength;
}

function sharedSuffix(current, old, searchLength) {
  let index1 = current.length;
  let index2 = old.length;
  let count = 0;

  while (count < searchLength && current[--index1] === old[--index2]) {
    count++;
  }

  return count;
}

function intersect(start1, end1, start2, end2) {
  // Disjoint
  if (end1 < start2 || end2 < start1) {
    return -1;
  } // Adjacent


  if (end1 === start2 || end2 === start1) {
    return 0;
  } // Non-zero intersect, span1 first


  if (start1 < start2) {
    if (end1 < end2) {
      return end1 - start2; // Overlap
    }

    return end2 - start2; // Contained
  } // Non-zero intersect, span2 first


  if (end2 < end1) {
    return end2 - start1; // Overlap
  }

  return end1 - start1; // Contained
}
/**
 * Splice Projection functions:
 *
 * A splice map is a representation of how a previous array of items
 * was transformed into a new array of items. Conceptually it is a list of
 * tuples of
 *
 *   <index, removed, addedCount>
 *
 * which are kept in ascending index order of. The tuple represents that at
 * the |index|, |removed| sequence of items were removed, and counting forward
 * from |index|, |addedCount| items were added.
 */

/**
 * @internal
 * @remarks
 * Lacking individual splice mutation information, the minimal set of
 * splices can be synthesized given the previous state and final state of an
 * array. The basic approach is to calculate the edit distance matrix and
 * choose the shortest path through it.
 *
 * Complexity: O(l * p)
 *   l: The length of the current array
 *   p: The length of the old array
 */


function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
  let prefixCount = 0;
  let suffixCount = 0;
  const minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);

  if (currentStart === 0 && oldStart === 0) {
    prefixCount = sharedPrefix(current, old, minLength);
  }

  if (currentEnd === current.length && oldEnd === old.length) {
    suffixCount = sharedSuffix(current, old, minLength - prefixCount);
  }

  currentStart += prefixCount;
  oldStart += prefixCount;
  currentEnd -= suffixCount;
  oldEnd -= suffixCount;

  if (currentEnd - currentStart === 0 && oldEnd - oldStart === 0) {
    return emptyArray;
  }

  if (currentStart === currentEnd) {
    const splice = newSplice(currentStart, [], 0);

    while (oldStart < oldEnd) {
      splice.removed.push(old[oldStart++]);
    }

    return [splice];
  } else if (oldStart === oldEnd) {
    return [newSplice(currentStart, [], currentEnd - currentStart)];
  }

  const ops = spliceOperationsFromEditDistances(calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));
  const splices = [];
  let splice = void 0;
  let index = currentStart;
  let oldIndex = oldStart;

  for (let i = 0; i < ops.length; ++i) {
    switch (ops[i]) {
      case EDIT_LEAVE:
        if (splice !== void 0) {
          splices.push(splice);
          splice = void 0;
        }

        index++;
        oldIndex++;
        break;

      case EDIT_UPDATE:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.addedCount++;
        index++;
        splice.removed.push(old[oldIndex]);
        oldIndex++;
        break;

      case EDIT_ADD:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.addedCount++;
        index++;
        break;

      case EDIT_DELETE:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.removed.push(old[oldIndex]);
        oldIndex++;
        break;
      // no default
    }
  }

  if (splice !== void 0) {
    splices.push(splice);
  }

  return splices;
}
const $push = Array.prototype.push;

function mergeSplice(splices, index, removed, addedCount) {
  const splice = newSplice(index, removed, addedCount);
  let inserted = false;
  let insertionOffset = 0;

  for (let i = 0, ii = splices.length; i < ii; i++) {
    const current = splices[i];
    current.index += insertionOffset;

    if (inserted) {
      continue;
    }

    const intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);

    if (intersectCount >= 0) {
      // Merge the two splices
      splices.splice(i, 1);
      i--;
      insertionOffset -= current.addedCount - current.removed.length;
      splice.addedCount += current.addedCount - intersectCount;
      const deleteCount = splice.removed.length + current.removed.length - intersectCount;

      if (!splice.addedCount && !deleteCount) {
        // merged splice is a noop. discard.
        inserted = true;
      } else {
        let currentRemoved = current.removed;

        if (splice.index < current.index) {
          // some prefix of splice.removed is prepended to current.removed.
          const prepend = splice.removed.slice(0, current.index - splice.index);
          $push.apply(prepend, currentRemoved);
          currentRemoved = prepend;
        }

        if (splice.index + splice.removed.length > current.index + current.addedCount) {
          // some suffix of splice.removed is appended to current.removed.
          const append = splice.removed.slice(current.index + current.addedCount - splice.index);
          $push.apply(currentRemoved, append);
        }

        splice.removed = currentRemoved;

        if (current.index < splice.index) {
          splice.index = current.index;
        }
      }
    } else if (splice.index < current.index) {
      // Insert splice here.
      inserted = true;
      splices.splice(i, 0, splice);
      i++;
      const offset = splice.addedCount - splice.removed.length;
      current.index += offset;
      insertionOffset += offset;
    }
  }

  if (!inserted) {
    splices.push(splice);
  }
}

function createInitialSplices(changeRecords) {
  const splices = [];

  for (let i = 0, ii = changeRecords.length; i < ii; i++) {
    const record = changeRecords[i];
    mergeSplice(splices, record.index, record.removed, record.addedCount);
  }

  return splices;
}
/** @internal */


function projectArraySplices(array, changeRecords) {
  let splices = [];
  const initialSplices = createInitialSplices(changeRecords);

  for (let i = 0, ii = initialSplices.length; i < ii; ++i) {
    const splice = initialSplices[i];

    if (splice.addedCount === 1 && splice.removed.length === 1) {
      if (splice.removed[0] !== array[splice.index]) {
        splices.push(splice);
      }

      continue;
    }

    splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
  }

  return splices;
}

let arrayObservationEnabled = false;

function adjustIndex(changeRecord, array) {
  let index = changeRecord.index;
  const arrayLength = array.length;

  if (index > arrayLength) {
    index = arrayLength - changeRecord.addedCount;
  } else if (index < 0) {
    index = arrayLength + changeRecord.removed.length + index - changeRecord.addedCount;
  }

  if (index < 0) {
    index = 0;
  }

  changeRecord.index = index;
  return changeRecord;
}

class ArrayObserver extends SubscriberSet {
  constructor(source) {
    super(source);
    this.oldCollection = void 0;
    this.splices = void 0;
    this.needsQueue = true;
    this.call = this.flush;
    source.$fastController = this;
  }

  addSplice(splice) {
    if (this.splices === void 0) {
      this.splices = [splice];
    } else {
      this.splices.push(splice);
    }

    if (this.needsQueue) {
      this.needsQueue = false;
      DOM.queueUpdate(this);
    }
  }

  reset(oldCollection) {
    this.oldCollection = oldCollection;

    if (this.needsQueue) {
      this.needsQueue = false;
      DOM.queueUpdate(this);
    }
  }

  flush() {
    const splices = this.splices;
    const oldCollection = this.oldCollection;

    if (splices === void 0 && oldCollection === void 0) {
      return;
    }

    this.needsQueue = true;
    this.splices = void 0;
    this.oldCollection = void 0;
    const finalSplices = oldCollection === void 0 ? projectArraySplices(this.source, splices) : calcSplices(this.source, 0, this.source.length, oldCollection, 0, oldCollection.length);
    this.notify(finalSplices);
  }

}
/* eslint-disable prefer-rest-params */

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/**
 * Enables the array observation mechanism.
 * @remarks
 * Array observation is enabled automatically when using the
 * {@link RepeatDirective}, so calling this API manually is
 * not typically necessary.
 * @public
 */


function enableArrayObservation() {
  if (arrayObservationEnabled) {
    return;
  }

  arrayObservationEnabled = true;
  Observable.setArrayObserverFactory(collection => {
    return new ArrayObserver(collection);
  });
  const arrayProto = Array.prototype;
  const pop = arrayProto.pop;
  const push = arrayProto.push;
  const reverse = arrayProto.reverse;
  const shift = arrayProto.shift;
  const sort = arrayProto.sort;
  const splice = arrayProto.splice;
  const unshift = arrayProto.unshift;

  arrayProto.pop = function () {
    const notEmpty = this.length > 0;
    const methodCallResult = pop.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0 && notEmpty) {
      o.addSplice(newSplice(this.length, [methodCallResult], 0));
    }

    return methodCallResult;
  };

  arrayProto.push = function () {
    const methodCallResult = push.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(this.length - arguments.length, [], arguments.length), this));
    }

    return methodCallResult;
  };

  arrayProto.reverse = function () {
    let oldArray;
    const o = this.$fastController;

    if (o !== void 0) {
      o.flush();
      oldArray = this.slice();
    }

    const methodCallResult = reverse.apply(this, arguments);

    if (o !== void 0) {
      o.reset(oldArray);
    }

    return methodCallResult;
  };

  arrayProto.shift = function () {
    const notEmpty = this.length > 0;
    const methodCallResult = shift.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0 && notEmpty) {
      o.addSplice(newSplice(0, [methodCallResult], 0));
    }

    return methodCallResult;
  };

  arrayProto.sort = function () {
    let oldArray;
    const o = this.$fastController;

    if (o !== void 0) {
      o.flush();
      oldArray = this.slice();
    }

    const methodCallResult = sort.apply(this, arguments);

    if (o !== void 0) {
      o.reset(oldArray);
    }

    return methodCallResult;
  };

  arrayProto.splice = function () {
    const methodCallResult = splice.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(+arguments[0], methodCallResult, arguments.length > 2 ? arguments.length - 2 : 0), this));
    }

    return methodCallResult;
  };

  arrayProto.unshift = function () {
    const methodCallResult = unshift.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(0, [], arguments.length), this));
    }

    return methodCallResult;
  };
}
/* eslint-enable prefer-rest-params */

/* eslint-enable @typescript-eslint/explicit-function-return-type */

const defaultRepeatOptions = Object.freeze({
  positioning: false
});

function bindWithoutPositioning(view, items, index, context) {
  view.bind(items[index], context);
}

function bindWithPositioning(view, items, index, context) {
  const childContext = Object.create(context);
  childContext.index = index;
  childContext.length = items.length;
  view.bind(items[index], childContext);
}
/**
 * A behavior that renders a template for each item in an array.
 * @public
 */


class RepeatBehavior {
  /**
   * Creates an instance of RepeatBehavior.
   * @param location - The location in the DOM to render the repeat.
   * @param itemsBinding - The array to render.
   * @param isItemsBindingVolatile - Indicates whether the items binding has volatile dependencies.
   * @param templateBinding - The template to render for each item.
   * @param isTemplateBindingVolatile - Indicates whether the template binding has volatile dependencies.
   * @param options - Options used to turn on special repeat features.
   */
  constructor(location, itemsBinding, isItemsBindingVolatile, templateBinding, isTemplateBindingVolatile, options) {
    this.location = location;
    this.itemsBinding = itemsBinding;
    this.templateBinding = templateBinding;
    this.options = options;
    this.source = null;
    this.views = [];
    this.items = null;
    this.itemsObserver = null;
    this.originalContext = void 0;
    this.childContext = void 0;
    this.bindView = bindWithoutPositioning;
    this.itemsBindingObserver = Observable.binding(itemsBinding, this, isItemsBindingVolatile);
    this.templateBindingObserver = Observable.binding(templateBinding, this, isTemplateBindingVolatile);

    if (options.positioning) {
      this.bindView = bindWithPositioning;
    }
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source, context) {
    this.source = source;
    this.originalContext = context;
    this.childContext = Object.create(context);
    this.childContext.parent = source;
    this.items = this.itemsBindingObserver.observe(source, this.originalContext);
    this.template = this.templateBindingObserver.observe(source, this.originalContext);
    this.observeItems();
    this.refreshAllViews();
  }
  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */


  unbind() {
    this.source = null;
    this.items = null;

    if (this.itemsObserver !== null) {
      this.itemsObserver.unsubscribe(this);
    }

    this.unbindAllViews();
    this.itemsBindingObserver.disconnect();
    this.templateBindingObserver.disconnect();
  }
  /** @internal */


  handleChange(source, args) {
    if (source === this.itemsBinding) {
      this.items = this.itemsBindingObserver.observe(this.source, this.originalContext);
      this.observeItems();
      this.refreshAllViews();
    } else if (source === this.templateBinding) {
      this.template = this.templateBindingObserver.observe(this.source, this.originalContext);
      this.refreshAllViews(true);
    } else {
      this.updateViews(args);
    }
  }

  observeItems() {
    if (!this.items) {
      this.items = [];
    }

    const oldObserver = this.itemsObserver;
    const newObserver = this.itemsObserver = Observable.getNotifier(this.items);

    if (oldObserver !== newObserver) {
      if (oldObserver !== null) {
        oldObserver.unsubscribe(this);
      }

      newObserver.subscribe(this);
    }
  }

  updateViews(splices) {
    const childContext = this.childContext;
    const views = this.views;
    const totalRemoved = [];
    const bindView = this.bindView;
    let removeDelta = 0;

    for (let i = 0, ii = splices.length; i < ii; ++i) {
      const splice = splices[i];
      const removed = splice.removed;
      totalRemoved.push(...views.splice(splice.index + removeDelta, removed.length));
      removeDelta -= splice.addedCount;
    }

    const items = this.items;
    const template = this.template;

    for (let i = 0, ii = splices.length; i < ii; ++i) {
      const splice = splices[i];
      let addIndex = splice.index;
      const end = addIndex + splice.addedCount;

      for (; addIndex < end; ++addIndex) {
        const neighbor = views[addIndex];
        const location = neighbor ? neighbor.firstChild : this.location;
        const view = totalRemoved.length > 0 ? totalRemoved.shift() : template.create();
        views.splice(addIndex, 0, view);
        bindView(view, items, addIndex, childContext);
        view.insertBefore(location);
      }
    }

    for (let i = 0, ii = totalRemoved.length; i < ii; ++i) {
      totalRemoved[i].dispose();
    }

    if (this.options.positioning) {
      for (let i = 0, ii = views.length; i < ii; ++i) {
        const currentContext = views[i].context;
        currentContext.length = ii;
        currentContext.index = i;
      }
    }
  }

  refreshAllViews(templateChanged = false) {
    const items = this.items;
    const childContext = this.childContext;
    const template = this.template;
    const location = this.location;
    const bindView = this.bindView;
    let itemsLength = items.length;
    let views = this.views;
    let viewsLength = views.length;

    if (itemsLength === 0 || templateChanged) {
      // all views need to be removed
      HTMLView.disposeContiguousBatch(views);
      viewsLength = 0;
    }

    if (viewsLength === 0) {
      // all views need to be created
      this.views = views = new Array(itemsLength);

      for (let i = 0; i < itemsLength; ++i) {
        const view = template.create();
        bindView(view, items, i, childContext);
        views[i] = view;
        view.insertBefore(location);
      }
    } else {
      // attempt to reuse existing views with new data
      let i = 0;

      for (; i < itemsLength; ++i) {
        if (i < viewsLength) {
          const view = views[i];
          bindView(view, items, i, childContext);
        } else {
          const view = template.create();
          bindView(view, items, i, childContext);
          views.push(view);
          view.insertBefore(location);
        }
      }

      const removed = views.splice(i, viewsLength - i);

      for (i = 0, itemsLength = removed.length; i < itemsLength; ++i) {
        removed[i].dispose();
      }
    }
  }

  unbindAllViews() {
    const views = this.views;

    for (let i = 0, ii = views.length; i < ii; ++i) {
      views[i].unbind();
    }
  }

}
/**
 * A directive that configures list rendering.
 * @public
 */

class RepeatDirective extends Directive {
  /**
   * Creates an instance of RepeatDirective.
   * @param itemsBinding - The binding that provides the array to render.
   * @param templateBinding - The template binding used to obtain a template to render for each item in the array.
   * @param options - Options used to turn on special repeat features.
   */
  constructor(itemsBinding, templateBinding, options) {
    super();
    this.itemsBinding = itemsBinding;
    this.templateBinding = templateBinding;
    this.options = options;
    /**
     * Creates a placeholder string based on the directive's index within the template.
     * @param index - The index of the directive within the template.
     */

    this.createPlaceholder = DOM.createBlockPlaceholder;
    enableArrayObservation();
    this.isItemsBindingVolatile = Observable.isVolatileBinding(itemsBinding);
    this.isTemplateBindingVolatile = Observable.isVolatileBinding(templateBinding);
  }
  /**
   * Creates a behavior for the provided target node.
   * @param target - The node instance to create the behavior for.
   */


  createBehavior(target) {
    return new RepeatBehavior(target, this.itemsBinding, this.isItemsBindingVolatile, this.templateBinding, this.isTemplateBindingVolatile, this.options);
  }

}
/**
 * A directive that enables list rendering.
 * @param itemsBinding - The array to render.
 * @param templateOrTemplateBinding - The template or a template binding used obtain a template
 * to render for each item in the array.
 * @param options - Options used to turn on special repeat features.
 * @public
 */

function repeat(itemsBinding, templateOrTemplateBinding, options = defaultRepeatOptions) {
  const templateBinding = typeof templateOrTemplateBinding === "function" ? templateOrTemplateBinding : () => templateOrTemplateBinding;
  return new RepeatDirective(itemsBinding, templateBinding, options);
}

/**
 * Creates a function that can be used to filter a Node array, selecting only elements.
 * @param selector - An optional selector to restrict the filter to.
 * @public
 */

function elements(selector) {
  if (selector) {
    return function (value, index, array) {
      return value.nodeType === 1 && value.matches(selector);
    };
  }

  return function (value, index, array) {
    return value.nodeType === 1;
  };
}
/**
 * A base class for node observation.
 * @internal
 */

class NodeObservationBehavior {
  /**
   * Creates an instance of NodeObservationBehavior.
   * @param target - The target to assign the nodes property on.
   * @param options - The options to use in configuring node observation.
   */
  constructor(target, options) {
    this.target = target;
    this.options = options;
    this.source = null;
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source) {
    const name = this.options.property;
    this.shouldUpdate = Observable.getAccessors(source).some(x => x.name === name);
    this.source = source;
    this.updateTarget(this.computeNodes());

    if (this.shouldUpdate) {
      this.observe();
    }
  }
  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */


  unbind() {
    this.updateTarget(emptyArray);
    this.source = null;

    if (this.shouldUpdate) {
      this.disconnect();
    }
  }
  /** @internal */


  handleEvent() {
    this.updateTarget(this.computeNodes());
  }

  computeNodes() {
    let nodes = this.getNodes();

    if (this.options.filter !== void 0) {
      nodes = nodes.filter(this.options.filter);
    }

    return nodes;
  }

  updateTarget(value) {
    this.source[this.options.property] = value;
  }

}

/**
 * The runtime behavior for slotted node observation.
 * @public
 */

class SlottedBehavior extends NodeObservationBehavior {
  /**
   * Creates an instance of SlottedBehavior.
   * @param target - The slot element target to observe.
   * @param options - The options to use when observing the slot.
   */
  constructor(target, options) {
    super(target, options);
  }
  /**
   * Begins observation of the nodes.
   */


  observe() {
    this.target.addEventListener("slotchange", this);
  }
  /**
   * Disconnects observation of the nodes.
   */


  disconnect() {
    this.target.removeEventListener("slotchange", this);
  }
  /**
   * Retrieves the nodes that should be assigned to the target.
   */


  getNodes() {
    return this.target.assignedNodes(this.options);
  }

}
/**
 * A directive that observes the `assignedNodes()` of a slot and updates a property
 * whenever they change.
 * @param propertyOrOptions - The options used to configure slotted node observation.
 * @public
 */

function slotted(propertyOrOptions) {
  if (typeof propertyOrOptions === "string") {
    propertyOrOptions = {
      property: propertyOrOptions
    };
  }

  return new AttachedBehaviorDirective("fast-slotted", SlottedBehavior, propertyOrOptions);
}

/**
 * The runtime behavior for child node observation.
 * @public
 */

class ChildrenBehavior extends NodeObservationBehavior {
  /**
   * Creates an instance of ChildrenBehavior.
   * @param target - The element target to observe children on.
   * @param options - The options to use when observing the element children.
   */
  constructor(target, options) {
    super(target, options);
    this.observer = null;
  }
  /**
   * Begins observation of the nodes.
   */


  observe() {
    if (this.observer === null) {
      this.observer = new MutationObserver(this.handleEvent.bind(this));
    }

    this.observer.observe(this.target, this.options);
  }
  /**
   * Disconnects observation of the nodes.
   */


  disconnect() {
    this.observer.disconnect();
  }
  /**
   * Retrieves the nodes that should be assigned to the target.
   */


  getNodes() {
    return Array.from(this.target.childNodes);
  }

}
/**
 * A directive that observes the `childNodes` of an element and updates a property
 * whenever they change.
 * @param propertyOrOptions - The options used to configure child node observation.
 * @public
 */

function children(propertyOrOptions) {
  if (typeof propertyOrOptions === "string") {
    propertyOrOptions = {
      property: propertyOrOptions,
      childList: true
    };
  } else {
    propertyOrOptions.childList = true;
  }

  return new AttachedBehaviorDirective("fast-children", ChildrenBehavior, propertyOrOptions);
}

const LabelTemplate = html`<template tabindex="0" class=" ${x => x.disabled ? "disabled" : ""} ${x => x.required ? "required" : ""}"><label part="label" for="${x => x.for}"><slot></slot></label></template>`;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
function __decorate(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * The template for the {@link @microsoft/fast-foundation#Accordion} component.
 * @public
 */

const AccordionTemplate = html`<template><slot name="item" part="item" ${slotted("accordionItems")}></slot></template>`;

var Orientation;

(function (Orientation) {
  Orientation["horizontal"] = "horizontal";
  Orientation["vertical"] = "vertical";
})(Orientation || (Orientation = {}));

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */

var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
/** Used as a reference to the global object. */

var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */

var Symbol = root.Symbol;

/** Used for built-in method references. */

var objectProto = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty = objectProto.hasOwnProperty;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString = objectProto.toString;
/** Built-in value references. */

var symToStringTag = Symbol ? Symbol.toStringTag : undefined;
/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */

function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);

  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }

  return result;
}

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString$1 = objectProto$1.toString;
/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */

function objectToString(value) {
  return nativeObjectToString$1.call(value);
}

/** `Object#toString` result references. */

var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';
/** Built-in value references. */

var symToStringTag$1 = Symbol ? Symbol.toStringTag : undefined;
/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */

function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }

  return symToStringTag$1 && symToStringTag$1 in Object(value) ? getRawTag(value) : objectToString(value);
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/** `Object#toString` result references. */

var symbolTag = '[object Symbol]';
/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */

function isSymbol(value) {
  return typeof value == 'symbol' || isObjectLike(value) && baseGetTag(value) == symbolTag;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/** Used as references for various `Number` constants. */

var NAN = 0 / 0;
/** Used to match leading and trailing whitespace. */

var reTrim = /^\s+|\s+$/g;
/** Used to detect bad signed hexadecimal string values. */

var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
/** Used to detect binary string values. */

var reIsBinary = /^0b[01]+$/i;
/** Used to detect octal string values. */

var reIsOctal = /^0o[0-7]+$/i;
/** Built-in method references without a dependency on `root`. */

var freeParseInt = parseInt;
/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */

function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }

  if (isSymbol(value)) {
    return NAN;
  }

  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? other + '' : other;
  }

  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }

  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
}

/** Used as references for various `Number` constants. */

var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308;
/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */

function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }

  value = toNumber(value);

  if (value === INFINITY || value === -INFINITY) {
    var sign = value < 0 ? -1 : 1;
    return sign * MAX_INTEGER;
  }

  return value === value ? value : 0;
}

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

/** `Object#toString` result references. */

var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';
/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */

function isFunction(value) {
  if (!isObject(value)) {
    return false;
  } // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.


  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/** Used to detect overreaching core-js shims. */

var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */

var maskSrcKey = function () {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? 'Symbol(src)_1.' + uid : '';
}();
/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */


function isMasked(func) {
  return !!maskSrcKey && maskSrcKey in func;
}

/** Used for built-in method references. */
var funcProto = Function.prototype;
/** Used to resolve the decompiled source of functions. */

var funcToString = funcProto.toString;
/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */

function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}

    try {
      return func + '';
    } catch (e) {}
  }

  return '';
}

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */

var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
/** Used to detect host constructors (Safari). */

var reIsHostCtor = /^\[object .+?Constructor\]$/;
/** Used for built-in method references. */

var funcProto$1 = Function.prototype,
    objectProto$2 = Object.prototype;
/** Used to resolve the decompiled source of functions. */

var funcToString$1 = funcProto$1.toString;
/** Used to check objects for own properties. */

var hasOwnProperty$1 = objectProto$2.hasOwnProperty;
/** Used to detect if a method is native. */

var reIsNative = RegExp('^' + funcToString$1.call(hasOwnProperty$1).replace(reRegExpChar, '\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */

function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }

  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */

function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new constant function.
 * @example
 *
 * var objects = _.times(2, _.constant({ 'a': 1 }));
 *
 * console.log(objects);
 * // => [{ 'a': 1 }, { 'a': 1 }]
 *
 * console.log(objects[0] === objects[1]);
 * // => true
 */
function constant(value) {
  return function () {
    return value;
  };
}

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;
/** Used to detect unsigned integer values. */

var reIsUint = /^(?:0|[1-9]\d*)$/;
/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */

function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length && (type == 'number' || type != 'symbol' && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || value !== value && other !== other;
}

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER$1 = 9007199254740991;
/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */

function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */

function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/** Used for built-in method references. */
var objectProto$3 = Object.prototype;
/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */

function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = typeof Ctor == 'function' && Ctor.prototype || objectProto$3;
  return value === proto;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }

  return result;
}

/** `Object#toString` result references. */

var argsTag = '[object Arguments]';
/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */

function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

/** Used for built-in method references. */

var objectProto$4 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$2 = objectProto$4.hasOwnProperty;
/** Built-in value references. */

var propertyIsEnumerable = objectProto$4.propertyIsEnumerable;
/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */

var isArguments = baseIsArguments(function () {
  return arguments;
}()) ? baseIsArguments : function (value) {
  return isObjectLike(value) && hasOwnProperty$2.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
};

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

/** Detect free variable `exports`. */

var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */

var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
/** Detect the popular CommonJS extension `module.exports`. */

var moduleExports = freeModule && freeModule.exports === freeExports;
/** Built-in value references. */

var Buffer = moduleExports ? root.Buffer : undefined;
/* Built-in method references for those with the same name as other `lodash` methods. */

var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */

var isBuffer = nativeIsBuffer || stubFalse;

/** `Object#toString` result references. */

var argsTag$1 = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag$1 = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';
var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';
/** Used to identify `toStringTag` values of typed arrays. */

var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag$1] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */

function baseIsTypedArray(value) {
  return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function (value) {
    return func(value);
  };
}

/** Detect free variable `exports`. */

var freeExports$1 = typeof exports == 'object' && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */

var freeModule$1 = freeExports$1 && typeof module == 'object' && module && !module.nodeType && module;
/** Detect the popular CommonJS extension `module.exports`. */

var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;
/** Detect free variable `process` from Node.js. */

var freeProcess = moduleExports$1 && freeGlobal.process;
/** Used to access faster Node.js helpers. */

var nodeUtil = function () {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule$1 && freeModule$1.require && freeModule$1.require('util').types;

    if (types) {
      return types;
    } // Legacy `process.binding('util')` for Node.js < 10.


    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}();

/* Node.js helper references. */

var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */

var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/** Used for built-in method references. */

var objectProto$5 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$3 = objectProto$5.hasOwnProperty;
/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */

function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty$3.call(value, key)) && !(skipIndexes && ( // Safari 9 has enumerable `arguments.length` in strict mode.
    key == 'length' || // Node.js 0.10 has enumerable non-index properties on buffers.
    isBuff && (key == 'offset' || key == 'parent') || // PhantomJS 2 has enumerable non-index properties on typed arrays.
    isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset') || // Skip index properties.
    isIndex(key, length)))) {
      result.push(key);
    }
  }

  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function (arg) {
    return func(transform(arg));
  };
}

/* Built-in method references for those with the same name as other `lodash` methods. */

var nativeKeys = overArg(Object.keys, Object);

/** Used for built-in method references. */

var objectProto$6 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$4 = objectProto$6.hasOwnProperty;
/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */

function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }

  var result = [];

  for (var key in Object(object)) {
    if (hasOwnProperty$4.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }

  return result;
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */

function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/* Built-in method references that are verified to be native. */

var nativeCreate = getNative(Object, 'create');

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */

function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

/** Used to stand-in for `undefined` hash values. */

var HASH_UNDEFINED = '__lodash_hash_undefined__';
/** Used for built-in method references. */

var objectProto$7 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$5 = objectProto$7.hasOwnProperty;
/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */

function hashGet(key) {
  var data = this.__data__;

  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }

  return hasOwnProperty$5.call(data, key) ? data[key] : undefined;
}

/** Used for built-in method references. */

var objectProto$8 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$6 = objectProto$8.hasOwnProperty;
/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */

function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty$6.call(data, key);
}

/** Used to stand-in for `undefined` hash values. */

var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';
/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */

function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED$1 : value;
  return this;
}

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */

function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;
  this.clear();

  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
} // Add methods to `Hash`.


Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */

function assocIndexOf(array, key) {
  var length = array.length;

  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }

  return -1;
}

/** Used for built-in method references. */

var arrayProto = Array.prototype;
/** Built-in value references. */

var splice = arrayProto.splice;
/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */

function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }

  var lastIndex = data.length - 1;

  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }

  --this.size;
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */

function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);
  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */

function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */

function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }

  return this;
}

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */

function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;
  this.clear();

  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
} // Add methods to `ListCache`.


ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/* Built-in method references that are verified to be native. */

var Map$1 = getNative(root, 'Map');

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */

function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash(),
    'map': new (Map$1 || ListCache)(),
    'string': new Hash()
  };
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean' ? value !== '__proto__' : value === null;
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */

function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key) ? data[typeof key == 'string' ? 'string' : 'hash'] : data.map;
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */

function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */

function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */

function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */

function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;
  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */

function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;
  this.clear();

  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
} // Add methods to `MapCache`.


MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/** Error message constants. */

var FUNC_ERROR_TEXT = 'Expected a function';
/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */

function memoize(func, resolver) {
  if (typeof func != 'function' || resolver != null && typeof resolver != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }

  var memoized = function () {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }

    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };

  memoized.cache = new (memoize.Cache || MapCache)();
  return memoized;
} // Expose `MapCache`.


memoize.Cache = MapCache;

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function (object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];

      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }

    return object;
  };
}

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */

var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */

function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;
/**
 * The base implementation of `_.inRange` which doesn't coerce arguments.
 *
 * @private
 * @param {number} number The number to check.
 * @param {number} start The start of the range.
 * @param {number} end The end of the range.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 */

function baseInRange(number, start, end) {
  return number >= nativeMin(start, end) && number < nativeMax(start, end);
}

/**
 * Checks if `n` is between `start` and up to, but not including, `end`. If
 * `end` is not specified, it's set to `start` with `start` then set to `0`.
 * If `start` is greater than `end` the params are swapped to support
 * negative ranges.
 *
 * @static
 * @memberOf _
 * @since 3.3.0
 * @category Number
 * @param {number} number The number to check.
 * @param {number} [start=0] The start of the range.
 * @param {number} end The end of the range.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 * @see _.range, _.rangeRight
 * @example
 *
 * _.inRange(3, 2, 4);
 * // => true
 *
 * _.inRange(4, 8);
 * // => true
 *
 * _.inRange(4, 2);
 * // => false
 *
 * _.inRange(2, 2);
 * // => false
 *
 * _.inRange(1.2, 2);
 * // => true
 *
 * _.inRange(5.2, 4);
 * // => false
 *
 * _.inRange(-3, -2, -6);
 * // => true
 */

function inRange(number, start, end) {
  start = toFinite(start);

  if (end === undefined) {
    end = start;
    start = 0;
  } else {
    end = toFinite(end);
  }

  number = toNumber(number);
  return baseInRange(number, start, end);
}

/**
 * The base implementation of `_.invert` and `_.invertBy` which inverts
 * `object` with values transformed by `iteratee` and set by `setter`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} setter The function to set `accumulator` values.
 * @param {Function} iteratee The iteratee to transform values.
 * @param {Object} accumulator The initial inverted object.
 * @returns {Function} Returns `accumulator`.
 */

function baseInverter(object, setter, iteratee, accumulator) {
  baseForOwn(object, function (value, key, object) {
    setter(accumulator, iteratee(value), key, object);
  });
  return accumulator;
}

/**
 * Creates a function like `_.invertBy`.
 *
 * @private
 * @param {Function} setter The function to set accumulator values.
 * @param {Function} toIteratee The function to resolve iteratees.
 * @returns {Function} Returns the new inverter function.
 */

function createInverter(setter, toIteratee) {
  return function (object, iteratee) {
    return baseInverter(object, setter, toIteratee(iteratee), {});
  };
}

/** Used for built-in method references. */

var objectProto$9 = Object.prototype;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString$2 = objectProto$9.toString;
/**
 * Creates an object composed of the inverted keys and values of `object`.
 * If `object` contains duplicate values, subsequent values overwrite
 * property assignments of previous values.
 *
 * @static
 * @memberOf _
 * @since 0.7.0
 * @category Object
 * @param {Object} object The object to invert.
 * @returns {Object} Returns the new inverted object.
 * @example
 *
 * var object = { 'a': 1, 'b': 2, 'c': 1 };
 *
 * _.invert(object);
 * // => { '1': 'c', '2': 'b' }
 */

var invert = createInverter(function (result, value, key) {
  if (value != null && typeof value.toString != 'function') {
    value = nativeObjectToString$2.call(value);
  }

  result[value] = key;
}, constant(identity));

/** `Object#toString` result references. */

var boolTag$1 = '[object Boolean]';
/**
 * Checks if `value` is classified as a boolean primitive or object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
 * @example
 *
 * _.isBoolean(false);
 * // => true
 *
 * _.isBoolean(null);
 * // => false
 */

function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag$1;
}

/**
 * Checks if the DOM is available to access and use
 */
function canUseDOM() {
  return !!(typeof window !== "undefined" && window.document && window.document.createElement);
}

/**
 * A test that ensures that all arguments are HTML Elements
 */

function isHTMLElement(...args) {
  return args.every(arg => arg instanceof HTMLElement);
}
/**
 * Returns all displayed elements inside of a root node that match a provided selector
 */

function getDisplayedNodes(rootNode, selector) {
  if (!isHTMLElement(rootNode)) {
    return;
  }

  const nodes = Array.from(rootNode.querySelectorAll(selector)); // offsetParent will be null if the element isn't currently displayed,
  // so this will allow us to operate only on visible nodes

  return nodes.filter(node => node.offsetParent !== null);
}
/**
 * Test if the document supports :focus-visible
 */

let _canUseFocusVisible;

function canUseFocusVisible() {
  if (isBoolean(_canUseFocusVisible)) {
    return _canUseFocusVisible;
  }

  if (!canUseDOM()) {
    _canUseFocusVisible = false;
    return _canUseFocusVisible;
  } // Check to see if the document supports the focus-visible element


  const styleElement = document.createElement("style");
  document.head.appendChild(styleElement);

  try {
    styleElement.sheet.insertRule("foo:focus-visible {color:inherit}", 0);
    _canUseFocusVisible = true;
  } catch (e) {
    _canUseFocusVisible = false;
  } finally {
    document.head.removeChild(styleElement);
  }

  return _canUseFocusVisible;
}

/*
 * Key Code values
 * @deprecated - use individual keycode exports
 */
var KeyCodes;

(function (KeyCodes) {
  KeyCodes[KeyCodes["alt"] = 18] = "alt";
  KeyCodes[KeyCodes["arrowDown"] = 40] = "arrowDown";
  KeyCodes[KeyCodes["arrowLeft"] = 37] = "arrowLeft";
  KeyCodes[KeyCodes["arrowRight"] = 39] = "arrowRight";
  KeyCodes[KeyCodes["arrowUp"] = 38] = "arrowUp";
  KeyCodes[KeyCodes["back"] = 8] = "back";
  KeyCodes[KeyCodes["backSlash"] = 220] = "backSlash";
  KeyCodes[KeyCodes["break"] = 19] = "break";
  KeyCodes[KeyCodes["capsLock"] = 20] = "capsLock";
  KeyCodes[KeyCodes["closeBracket"] = 221] = "closeBracket";
  KeyCodes[KeyCodes["colon"] = 186] = "colon";
  KeyCodes[KeyCodes["colon2"] = 59] = "colon2";
  KeyCodes[KeyCodes["comma"] = 188] = "comma";
  KeyCodes[KeyCodes["ctrl"] = 17] = "ctrl";
  KeyCodes[KeyCodes["delete"] = 46] = "delete";
  KeyCodes[KeyCodes["end"] = 35] = "end";
  KeyCodes[KeyCodes["enter"] = 13] = "enter";
  KeyCodes[KeyCodes["equals"] = 187] = "equals";
  KeyCodes[KeyCodes["equals2"] = 61] = "equals2";
  KeyCodes[KeyCodes["equals3"] = 107] = "equals3";
  KeyCodes[KeyCodes["escape"] = 27] = "escape";
  KeyCodes[KeyCodes["forwardSlash"] = 191] = "forwardSlash";
  KeyCodes[KeyCodes["function1"] = 112] = "function1";
  KeyCodes[KeyCodes["function10"] = 121] = "function10";
  KeyCodes[KeyCodes["function11"] = 122] = "function11";
  KeyCodes[KeyCodes["function12"] = 123] = "function12";
  KeyCodes[KeyCodes["function2"] = 113] = "function2";
  KeyCodes[KeyCodes["function3"] = 114] = "function3";
  KeyCodes[KeyCodes["function4"] = 115] = "function4";
  KeyCodes[KeyCodes["function5"] = 116] = "function5";
  KeyCodes[KeyCodes["function6"] = 117] = "function6";
  KeyCodes[KeyCodes["function7"] = 118] = "function7";
  KeyCodes[KeyCodes["function8"] = 119] = "function8";
  KeyCodes[KeyCodes["function9"] = 120] = "function9";
  KeyCodes[KeyCodes["home"] = 36] = "home";
  KeyCodes[KeyCodes["insert"] = 45] = "insert";
  KeyCodes[KeyCodes["menu"] = 93] = "menu";
  KeyCodes[KeyCodes["minus"] = 189] = "minus";
  KeyCodes[KeyCodes["minus2"] = 109] = "minus2";
  KeyCodes[KeyCodes["numLock"] = 144] = "numLock";
  KeyCodes[KeyCodes["numPad0"] = 96] = "numPad0";
  KeyCodes[KeyCodes["numPad1"] = 97] = "numPad1";
  KeyCodes[KeyCodes["numPad2"] = 98] = "numPad2";
  KeyCodes[KeyCodes["numPad3"] = 99] = "numPad3";
  KeyCodes[KeyCodes["numPad4"] = 100] = "numPad4";
  KeyCodes[KeyCodes["numPad5"] = 101] = "numPad5";
  KeyCodes[KeyCodes["numPad6"] = 102] = "numPad6";
  KeyCodes[KeyCodes["numPad7"] = 103] = "numPad7";
  KeyCodes[KeyCodes["numPad8"] = 104] = "numPad8";
  KeyCodes[KeyCodes["numPad9"] = 105] = "numPad9";
  KeyCodes[KeyCodes["numPadDivide"] = 111] = "numPadDivide";
  KeyCodes[KeyCodes["numPadDot"] = 110] = "numPadDot";
  KeyCodes[KeyCodes["numPadMinus"] = 109] = "numPadMinus";
  KeyCodes[KeyCodes["numPadMultiply"] = 106] = "numPadMultiply";
  KeyCodes[KeyCodes["numPadPlus"] = 107] = "numPadPlus";
  KeyCodes[KeyCodes["openBracket"] = 219] = "openBracket";
  KeyCodes[KeyCodes["pageDown"] = 34] = "pageDown";
  KeyCodes[KeyCodes["pageUp"] = 33] = "pageUp";
  KeyCodes[KeyCodes["period"] = 190] = "period";
  KeyCodes[KeyCodes["print"] = 44] = "print";
  KeyCodes[KeyCodes["quote"] = 222] = "quote";
  KeyCodes[KeyCodes["scrollLock"] = 145] = "scrollLock";
  KeyCodes[KeyCodes["shift"] = 16] = "shift";
  KeyCodes[KeyCodes["space"] = 32] = "space";
  KeyCodes[KeyCodes["tab"] = 9] = "tab";
  KeyCodes[KeyCodes["tilde"] = 192] = "tilde";
  KeyCodes[KeyCodes["windowsLeft"] = 91] = "windowsLeft";
  KeyCodes[KeyCodes["windowsOpera"] = 219] = "windowsOpera";
  KeyCodes[KeyCodes["windowsRight"] = 92] = "windowsRight";
})(KeyCodes || (KeyCodes = {}));
const keyCodeArrowDown = 40;
const keyCodeArrowLeft = 37;
const keyCodeArrowRight = 39;
const keyCodeArrowUp = 38;
const keyCodeEnd = 35;
const keyCodeEnter = 13;

const keyCodeEscape = 27;
const keyCodeHome = 36;
const keyCodeSpace = 32;
const keyCodeTab = 9;

/**
 * Expose ltr and rtl strings
 */
var Direction;

(function (Direction) {
  Direction["ltr"] = "ltr";
  Direction["rtl"] = "rtl";
})(Direction || (Direction = {}));

/**
 * This method keeps a given value within the bounds of a min and max value. If the value
 * is larger than the max, the minimum value will be returned. If the value is smaller than the minimum,
 * the maximum will be returned. Otherwise, the value is returned un-changed.
 */
function wrapInBounds(min, max, value) {
  if (value < min) {
    return max;
  } else if (value > max) {
    return min;
  }

  return value;
}
/**
 * Ensures that a value is between a min and max value. If value is lower than min, min will be returned.
 * If value is greater than max, max will be retured.
 */

function limit(min, max, value) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Define system colors for use in CSS stylesheets.
 *
 * https://drafts.csswg.org/css-color/#css-system-colors
 */
var SystemColors;

(function (SystemColors) {
  SystemColors["Canvas"] = "Canvas";
  SystemColors["CanvasText"] = "CanvasText";
  SystemColors["LinkText"] = "LinkText";
  SystemColors["VisitedText"] = "VisitedText";
  SystemColors["ActiveText"] = "ActiveText";
  SystemColors["ButtonFace"] = "ButtonFace";
  SystemColors["ButtonText"] = "ButtonText";
  SystemColors["Field"] = "Field";
  SystemColors["FieldText"] = "FieldText";
  SystemColors["Highlight"] = "Highlight";
  SystemColors["HighlightText"] = "HighlightText";
  SystemColors["GrayText"] = "GrayText";
})(SystemColors || (SystemColors = {}));

/**
 * A mixin class implementing start and end elements.
 * These are generally used to decorate text elements with icons or other visual indicators.
 * @public
 */

class StartEnd {
  handleStartContentChange() {
    this.startContainer.classList.toggle("start", this.start.assignedNodes().length > 0);
  }

  handleEndContentChange() {
    this.endContainer.classList.toggle("end", this.end.assignedNodes().length > 0);
  }

}
/**
 * The template for the end element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const endTemplate = html`<span part="end" ${ref("endContainer")}><slot name="end" ${ref("end")}@slotchange="${x => x.handleEndContentChange()}"></slot></span>`;
/**
 * The template for the start element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const startTemplate = html`<span part="start" ${ref("startContainer")}><slot name="start" ${ref("start")}@slotchange="${x => x.handleStartContentChange()}"></slot></span>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(AccordionItem:class)} component.
 * @public
 */

const AccordionItemTemplate = html`<template class="${x => x.expanded ? "expanded" : ""}" slot="item"><div class="heading" part="heading" role="heading" aria-level="${x => x.headinglevel}"><button class="button" part="button" ${ref("expandbutton")}aria-expanded="${x => x.expanded}" aria-controls="${x => x.id}-panel" id="${x => x.id}" @click="${(x, c) => x.clickHandler(c.event)}"><span class="heading"><slot name="heading" part="heading"></slot></span></button>${startTemplate} ${endTemplate}<span class="icon" part="icon"><slot name="expanded-icon" part="expanded-icon"></slot><slot name="collapsed-icon" part="collapsed-icon"></slot><span></div><div class="region" part="region" id="${x => x.id}-panel" role="region" aria-labelledby="${x => x.id}"><slot></slot></div></template>`;

/**
 * Apply mixins to a constructor.
 * Sourced from {@link https://www.typescriptlang.org/docs/handbook/mixins.html | TypeScript Documentation }.
 * @public
 */
function applyMixins(derivedCtor, ...baseCtors) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
    });
  });
}

/**
 * An individual item in an {@link @microsoft/fast-foundation#(Accordion:class) }.
 * @public
 */

class AccordionItem extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * Configures the {@link https://www.w3.org/TR/wai-aria-1.1/#aria-level | level} of the
     * heading element.
     *
     * @defaultValue 2
     * @public
     * @remarks
     * HTML attribute: heading-level
     */

    this.headinglevel = 2;
    /**
     * Expands or collapses the item.
     *
     * @public
     * @remarks
     * HTML attribute: expanded
     */

    this.expanded = false;
    /**
     * @internal
     */

    this.clickHandler = e => {
      this.expanded = !this.expanded;
      this.change();
    };

    this.change = () => {
      this.$emit("change");
    };
  }

}

__decorate([attr({
  attribute: "heading-level",
  mode: "fromView",
  converter: nullableNumberConverter
})], AccordionItem.prototype, "headinglevel", void 0);

__decorate([attr({
  mode: "boolean"
})], AccordionItem.prototype, "expanded", void 0);

__decorate([attr], AccordionItem.prototype, "id", void 0);

applyMixins(AccordionItem, StartEnd);

/**
 * Expand mode for {@link Accordion}
 * @public
 */

var AccordionExpandMode;

(function (AccordionExpandMode) {
  /**
   * Designates only a single {@link @microsoft/fast-foundation#(AccordionItem:class) } can be open a time.
   */
  AccordionExpandMode["single"] = "single";
  /**
   * Designates multiple {@link @microsoft/fast-foundation#(AccordionItem:class) | AccordionItems} can be open simultaneously.
   */

  AccordionExpandMode["multi"] = "multi";
})(AccordionExpandMode || (AccordionExpandMode = {}));
/**
 * An Accordion Custom HTML Element
 * Implements {@link https://www.w3.org/TR/wai-aria-practices-1.1/#accordion | ARIA Accordion}.
 * @public
 *
 * @remarks
 * Designed to be used with {@link @microsoft/fast-foundation#AccordionTemplate} and {@link @microsoft/fast-foundation#(AccordionItem:class)}.
 */


class Accordion extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * Controls the expand mode of the Accordion, either allowing
     * single or multiple item expansion.
     * @public
     *
     * @remarks
     * HTML attribute: expand-mode
     */

    this.expandmode = AccordionExpandMode.multi;
    this.activeItemIndex = 0;

    this.change = () => {
      this.$emit("change");
    };

    this.setItems = () => {
      this.accordionIds = this.getItemIds();
      this.accordionItems.forEach((item, index) => {
        if (item instanceof AccordionItem) {
          item.addEventListener("change", this.activeItemChange);

          if (this.isSingleExpandMode()) {
            this.activeItemIndex !== index ? item.expanded = false : item.expanded = true;
          }
        }

        const itemId = this.accordionIds[index];
        item.setAttribute("id", typeof itemId !== "string" ? `accordion-${index + 1}` : itemId);
        this.activeid = this.accordionIds[this.activeItemIndex];
        item.addEventListener("keydown", this.handleItemKeyDown);
      });
    };

    this.removeItemListeners = oldValue => {
      oldValue.forEach((item, index) => {
        item.removeEventListener("change", this.activeItemChange);
        item.removeEventListener("keydown", this.handleItemKeyDown);
      });
    };

    this.activeItemChange = event => {
      const selectedItem = event.target;

      if (this.isSingleExpandMode()) {
        this.resetItems();
        event.target.expanded = true;
      }

      this.activeid = event.target.getAttribute("id");
      this.activeItemIndex = Array.from(this.accordionItems).indexOf(selectedItem);
      this.change();
    };

    this.handleItemKeyDown = event => {
      const keyCode = event.keyCode;
      this.accordionIds = this.getItemIds();

      switch (keyCode) {
        case keyCodeArrowUp:
          event.preventDefault();
          this.adjust(-1);
          break;

        case keyCodeArrowDown:
          event.preventDefault();
          this.adjust(1);
          break;

        case keyCodeHome:
          this.activeItemIndex = 0;
          this.focusItem();
          break;

        case keyCodeEnd:
          this.activeItemIndex = this.accordionItems.length - 1;
          this.focusItem();
          break;
      }
    };
  }
  /**
   * @internal
   */


  accordionItemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.removeItemListeners(oldValue);
      this.accordionIds = this.getItemIds();
      this.setItems();
    }
  }

  resetItems() {
    this.accordionItems.forEach((item, index) => {
      item.expanded = false;
    });
  }

  getItemIds() {
    return this.accordionItems.map(accordionItem => {
      return accordionItem.getAttribute("id");
    });
  }

  isSingleExpandMode() {
    return this.expandmode === AccordionExpandMode.single;
  }

  adjust(adjustment) {
    this.activeItemIndex = wrapInBounds(0, this.accordionItems.length - 1, this.activeItemIndex + adjustment);
    this.focusItem();
  }

  focusItem() {
    const element = this.accordionItems[this.activeItemIndex];

    if (element instanceof AccordionItem) {
      element.expandbutton.focus();
    }
  }

}

__decorate([attr({
  attribute: "expand-mode"
})], Accordion.prototype, "expandmode", void 0);

__decorate([observable], Accordion.prototype, "accordionItems", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Anchor:class)} component.
 * @public
 */

const AnchorTemplate = html`<a class="control" part="control" download="${x => x.download}" href="${x => x.href}" hreflang="${x => x.hreflang}" ping="${x => x.ping}" referrerpolicy="${x => x.referrerpolicy}" rel="${x => x.rel}" target="${x => x.target}" type="${x => x.type}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-drrormessage="${x => x.ariaErrormessage}" aria-dxpanded="${x => x.ariaExpanded}" aria-flowto="${x => x.ariaDisabled}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}">${startTemplate}<span class="content" part="content"><slot></slot></span>${endTemplate}</a>`;

/**
 * Some states and properties are applicable to all host language elements regardless of whether a role is applied.
 * The following global states and properties are supported by all roles and by all base markup elements.
 * {@link https://www.w3.org/TR/wai-aria-1.1/#global_states}
 *
 * This is intended to be used as a mixin. Be sure you extend FASTElement.
 *
 * @public
 */

class ARIAGlobalStatesAndProperties {}

__decorate([attr({
  attribute: "aria-atomic",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaAtomic", void 0);

__decorate([attr({
  attribute: "aria-busy",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaBusy", void 0);

__decorate([attr({
  attribute: "aria-controls",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaControls", void 0);

__decorate([attr({
  attribute: "aria-current",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaCurrent", void 0);

__decorate([attr({
  attribute: "aria-describedby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDescribedby", void 0);

__decorate([attr({
  attribute: "aria-details",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDetails", void 0);

__decorate([attr({
  attribute: "aria-disabled",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDisabled", void 0);

__decorate([attr({
  attribute: "aria-errormessage",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaErrormessage", void 0);

__decorate([attr({
  attribute: "aria-flowto",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaFlowto", void 0);

__decorate([attr({
  attribute: "aria-haspopup",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaHaspopup", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaHidden", void 0);

__decorate([attr({
  attribute: "aria-invalid",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaInvalid", void 0);

__decorate([attr({
  attribute: "aria-keyshortcuts",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaKeyshortcuts", void 0);

__decorate([attr({
  attribute: "aria-label",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLabel", void 0);

__decorate([attr({
  attribute: "aria-labelledby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-live",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLive", void 0);

__decorate([attr({
  attribute: "aria-owns",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaOwns", void 0);

__decorate([attr({
  attribute: "aria-relevant",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaRelevant", void 0);

__decorate([attr({
  attribute: "aria-roledescription",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaRoledescription", void 0);

/**
 * An Anchor Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a | <a> element }.
 *
 * @public
 */

class Anchor extends FASTElement {}

__decorate([attr], Anchor.prototype, "download", void 0);

__decorate([attr], Anchor.prototype, "href", void 0);

__decorate([attr], Anchor.prototype, "hreflang", void 0);

__decorate([attr], Anchor.prototype, "ping", void 0);

__decorate([attr], Anchor.prototype, "referrerpolicy", void 0);

__decorate([attr], Anchor.prototype, "rel", void 0);

__decorate([attr], Anchor.prototype, "target", void 0);

__decorate([attr], Anchor.prototype, "type", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA link role
 *
 * @public
 */


class DelegatesARIALink extends ARIAGlobalStatesAndProperties {}

__decorate([attr({
  attribute: "aria-expanded",
  mode: "fromView"
})], DelegatesARIALink.prototype, "ariaExpanded", void 0);

applyMixins(Anchor, StartEnd, DelegatesARIALink);

/**
 * The template for the {@link @microsoft/fast-foundation#Badge} component.
 * @public
 */

const BadgeTemplate = html`<template class="${x => x.circular ? "circular" : ""}"><div class="control" part="control" style="${x => x.fill || x.color ? `background-color: var(--badge-fill-${x.fill}); color: var(--badge-color-${x.color})` : void 0}"><slot></slot></div></template>`;

/**
 * A Badge Custom HTML Element.
 *
 * @public
 */

class Badge extends FASTElement {}

__decorate([attr({
  attribute: "fill"
})], Badge.prototype, "fill", void 0);

__decorate([attr({
  attribute: "color"
})], Badge.prototype, "color", void 0);

__decorate([attr({
  mode: "boolean"
})], Badge.prototype, "circular", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Button:class)} component.
 * @public
 */

const ButtonTemplate = html`<button class="control" part="control" ?autofocus="${x => x.autofocus}" ?disabled="${x => x.disabled}" form="${x => x.formId}" formaction="${x => x.formaction}" formenctype="${x => x.formenctype}" formmethod="${x => x.formmethod}" formnovalidate="${x => x.formnovalidate}" formtarget="${x => x.formtarget}" name="${x => x.name}" type="${x => x.type}" value="${x => x.value}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-expanded="${x => x.ariaExpanded}" aria-flowto="${x => x.ariaDisabled}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-pressed="${x => x.ariaPressed}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}">${startTemplate}<span class="content" part="content"><slot></slot></span>${endTemplate}</button>`;

const supportsElementInternals = ("ElementInternals" in window);
/**
 * Disable member ordering to keep property callbacks
 * grouped with property declaration
 */

class FormAssociated extends FASTElement {
  constructor() {
    super();
    /**
     * The value of the element to be associated with the form
     */

    this.value = "";
    this.disabled = false;
    /**
     * Require the field prior to form submission
     */

    this.required = false;
    /**
     * These are events that are still fired by the proxy
     * element based on user / programmatic interaction.
     *
     * The proxy implementation should be transparent to
     * the app author, so block these events from emitting.
     */

    this.proxyEventsToBlock = ["change", "click"];

    if (supportsElementInternals) {
      this.elementInternals = this.attachInternals();
    }
  }
  /**
   * Must evaluate to true to enable elementInternals.
   * Feature detects API support and resolve respectively
   */


  static get formAssociated() {
    return supportsElementInternals;
  }
  /**
   * Returns the validty state of the element
   */


  get validity() {
    return supportsElementInternals ? this.elementInternals.validity : this.proxy.validity;
  }
  /**
   * Retrieve a reference to the associated form.
   * Returns null if not associated to any form.
   */


  get form() {
    return supportsElementInternals ? this.elementInternals.form : this.proxy.form;
  }
  /**
   * Retrieve the localized validation message,
   * or custom validation message if set.
   */


  get validationMessage() {
    return supportsElementInternals ? this.elementInternals.validationMessage : this.proxy.validationMessage;
  }
  /**
   * Whether the element will be validated when the
   * form is submitted
   */


  get willValidate() {
    return supportsElementInternals ? this.elementInternals.willValidate : this.proxy.willValidate;
  }
  /**
   * A reference to all associated label elements
   */


  get labels() {
    if (supportsElementInternals) {
      return Object.freeze(Array.from(this.elementInternals.labels));
    } else if (this.proxy instanceof HTMLElement && this.proxy.ownerDocument && this.id) {
      // Labels associated by wraping the element: <label><custom-element></custom-element></label>
      const parentLabels = this.proxy.labels; // Labels associated using the `for` attribute

      const forLabels = Array.from(this.proxy.getRootNode().querySelectorAll(`[for='${this.id}']`));
      const labels = parentLabels ? forLabels.concat(Array.from(parentLabels)) : forLabels;
      return Object.freeze(labels);
    } else {
      return emptyArray;
    }
  }

  disabledChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.disabled = this.disabled;
    }

    DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
  }

  nameChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.name = this.name;
    }
  }

  requiredChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.required = this.required;
    }

    DOM.queueUpdate(() => this.classList.toggle("required", this.required));
  }

  connectedCallback() {
    super.connectedCallback();

    if (!supportsElementInternals) {
      this.proxy.style.display = "none";
      this.appendChild(this.proxy);
      this.proxyEventsToBlock.forEach(name => this.proxy.addEventListener(name, this.stopPropagation)); // These are typically mapped to the proxy during
      // property change callbacks, but during initialization
      // on the intial call of the callback, the proxy is
      // still undefined. We should find a better way to address this.

      this.proxy.disabled = this.disabled;
      this.proxy.required = this.required;

      if (typeof this.name === "string") {
        this.proxy.name = this.name;
      }

      if (typeof this.value === "string") {
        this.proxy.value = this.value;
      }
    }
  }

  disconnectedCallback() {
    this.proxyEventsToBlock.forEach(name => this.proxy.removeEventListener(name, this.stopPropagation));
  }
  /**
   * Return the current validity of the element
   */


  checkValidity() {
    return supportsElementInternals ? this.elementInternals.checkValidity() : this.proxy.checkValidity();
  }
  /**
   * Return the current validity of the element.
   * If false, fires an invalid event at the element.
   */


  reportValidity() {
    return supportsElementInternals ? this.elementInternals.reportValidity() : this.proxy.reportValidity();
  }
  /**
   * Set the validity of the control. In cases when the elementInternals object is not
   * available (and the proxy element is used to report validity), this function will
   * do nothing unless a message is provided, at which point the setCustomValidity method
   * of the proxy element will be invoked with the provided message.
   * @param flags - Validity flags
   * @param message - Optional message to supply
   * @param anchor - Optional element used by UA to display an interactive validation UI
   */


  setValidity(flags, message, anchor) {
    if (supportsElementInternals) {
      this.elementInternals.setValidity(flags, message, anchor);
    } else if (typeof message === "string") {
      this.proxy.setCustomValidity(message);
    }
  }
  /**
   * Invoked when a connected component's form or fieldset has it's disabled
   * state changed.
   * @param disabled - the disabled value of the form / fieldset
   */


  formDisabledCallback(disabled) {
    this.disabled = disabled;
  }
  /**
   *
   * @param value - The value to set
   * @param state - The state object provided to during session restores and when autofilling.
   */


  setFormValue(value, state) {
    if (supportsElementInternals) {
      this.elementInternals.setFormValue(value, state);
    }
  }

  keypressHandler(e) {
    switch (e.keyCode) {
      case keyCodeEnter:
        if (this.form instanceof HTMLFormElement) {
          // Match native behavior
          this.form.submit();
        }

        break;
    }
  }
  /**
   * Used to stop propagation of proxy element events
   * @param e - Event object
   */


  stopPropagation(e) {
    e.stopPropagation();
  }

}

__decorate([attr], FormAssociated.prototype, "value", void 0);

__decorate([attr({
  mode: "boolean"
})], FormAssociated.prototype, "disabled", void 0);

__decorate([attr], FormAssociated.prototype, "name", void 0);

__decorate([attr({
  mode: "boolean"
})], FormAssociated.prototype, "required", void 0);

/**
 * An Button Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button | <button> element }.
 *
 * @public
 */

class Button extends FormAssociated {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

  formactionChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.formAction = this.formaction;
    }
  }

  formenctypeChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.formEnctype = this.formenctype;
    }
  }

  formmethodChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.formMethod = this.formmethod;
    }
  }

  formnovalidateChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.formNoValidate = this.formnovalidate;
    }
  }

  formtargetChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.formTarget = this.formtarget;
    }
  }

  typeChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.type = this.type;
    }
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", `${this.type}`);
    this.setFormValue(this.value, this.value);
  }

}

__decorate([attr({
  mode: "boolean"
})], Button.prototype, "autofocus", void 0);

__decorate([attr({
  attribute: "form"
})], Button.prototype, "formId", void 0);

__decorate([attr], Button.prototype, "formaction", void 0);

__decorate([attr], Button.prototype, "formenctype", void 0);

__decorate([attr], Button.prototype, "formmethod", void 0);

__decorate([attr({
  mode: "boolean"
})], Button.prototype, "formnovalidate", void 0);

__decorate([attr], Button.prototype, "formtarget", void 0);

__decorate([attr], Button.prototype, "name", void 0);

__decorate([attr], Button.prototype, "type", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA button role
 *
 * @public
 */


class DelegatesARIAButton extends ARIAGlobalStatesAndProperties {}

__decorate([attr({
  attribute: "aria-expanded",
  mode: "fromView"
})], DelegatesARIAButton.prototype, "ariaExpanded", void 0);

__decorate([attr({
  attribute: "aria-pressed",
  mode: "fromView"
})], DelegatesARIAButton.prototype, "ariaPressed", void 0);

applyMixins(Button, StartEnd, DelegatesARIAButton);

/**
 * The template for the {@link @microsoft/fast-foundation#Card} component.
 * @public
 */

const CardTemplate = html`<slot></slot>`;

/**
 * An Card Custom HTML Element.
 *
 * @public
 */

class Card extends FASTElement {}

/**
 * The template for the {@link @microsoft/fast-foundation#Checkbox} component.
 * @public
 */

const CheckboxTemplate = html`<template role="checkbox" aria-checked="${x => x.checked}" aria-required="${x => x.required}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" tabindex="${x => x.disabled ? null : 0}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}" class="${x => x.readOnly ? "readonly" : ""} ${x => x.checked ? "checked" : ""} ${x => x.indeterminate ? "indeterminate" : ""}"><div part="control" class="control"><slot name="checked-indicator"><svg aria-hidden="true" part="checked-indicator" class="checked-indicator" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8.143 12.6697L15.235 4.5L16.8 5.90363L8.23812 15.7667L3.80005 11.2556L5.27591 9.7555L8.143 12.6697Z" /></svg></slot><slot name="indeterminate-indicator"><div part="indeterminate-indicator" class="indeterminate-indicator"></div></slot></div><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label></template>`;

/**
 * A Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#checkbox | ARIA checkbox }.
 *
 * @public
 */

class Checkbox extends FormAssociated {
  constructor() {
    super();
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="checkbox"]
     *
     * @public
     */

    this.value = "on"; // Map to proxy element.

    /**
     * Initialized to the value of the checked attribute. Can be changed independently of the "checked" attribute,
     * but changing the "checked" attribute always additionally sets this value.
     *
     * @public
     */

    this.defaultChecked = !!this.checkedAttribute;
    /**
     * The checked state of the control.
     *
     * @public
     */

    this.checked = this.defaultChecked;
    this.proxy = document.createElement("input");
    /**
     * The indeterminate state of the control
     */

    this.indeterminate = false;
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input checkboxes
     */

    this.dirtyChecked = false;
    /**
     * Set to true when the component has constructed
     */

    this.constructed = false;
    /**
     * @internal
     */

    this.keypressHandler = e => {
      super.keypressHandler(e);

      switch (e.keyCode) {
        case keyCodeSpace:
          this.checked = !this.checked;
          break;
      }
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly) {
        this.checked = !this.checked;
      }
    };

    this.constructed = true;
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    if (!this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      this.checked = this.defaultChecked;
      this.dirtyChecked = false;
    }
  }

  checkedChanged() {
    if (!this.dirtyChecked) {
      this.dirtyChecked = true;
    }

    this.updateForm();

    if (this.proxy instanceof HTMLElement) {
      this.proxy.checked = this.checked;
    }

    if (this.constructed) {
      this.$emit("change");
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "checkbox");
    this.updateForm();
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Checkbox.prototype, "readOnly", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Checkbox.prototype, "checkedAttribute", void 0);

__decorate([observable], Checkbox.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Checkbox.prototype, "defaultChecked", void 0);

__decorate([observable], Checkbox.prototype, "checked", void 0);

__decorate([observable], Checkbox.prototype, "indeterminate", void 0);

/**
 * A Behavior that will register to a {@link CSSCustomPropertyTarget} when bound.
 *
 * @public
 */
class CSSCustomPropertyBehavior {
  /**
   *
   * @param name - The name of the custom property, without the prepended "--" required by {@link https://developer.mozilla.org/en-US/docs/Web/CSS/--* | CSS custom properties}.
   * @param value - The value of the custom property or a function that resolves the value.
   * @param host - A function that resolves the host element that will register the behavior
   */
  constructor(name, value, host) {
    this.name = name;
    this.value = value;
    this.host = host;
    this.propertyName = `--${name}`;
    this.var = `var(${this.propertyName})`;
  }
  /**
   * Binds the behavior to a source element
   * @param source - The source element being bound
   * @internal
   */


  bind(source) {
    const target = this.host(source);

    if (target !== null) {
      if (typeof target.registerCSSCustomProperty === "function") {
        target.registerCSSCustomProperty(this);
      } else {
        // There is potential for the custom property host element to not be
        // constructed when this is run. We handle that case by accumulating
        // the behaviors in a normal array. Behaviors associated this way will
        // get registered when the host is connected
        if (!Array.isArray(target.disconnectedCSSCustomPropertyRegistry)) {
          target.disconnectedCSSCustomPropertyRegistry = [];
        }

        target.disconnectedCSSCustomPropertyRegistry.push(this);
      }
    }
  }
  /**
   * Unbinds the behavior from the source element.
   * @param source - The source element being unbound
   * @internal
   */


  unbind(source) {
    const target = this.host(source);

    if (target !== null && typeof target.unregisterCSSCustomProperty === "function") {
      target.unregisterCSSCustomProperty(this);
    }
  }

}
/**
 * Create a CSS Custom Property behavior.
 * @param name - The name of the CSS custom property
 * @param value - The value or value resolver of the custom property
 * @param host - A function to resolve the element to host the CSS custom property
 * @public
 */

function cssCustomPropertyBehaviorFactory(name, value, host) {
  return new CSSCustomPropertyBehavior(name, value, host);
}

/**
 * Retrieves the "composed parent" element of a node, ignoring DOM tree boundaries.
 * When the parent of a node is a shadow-root, it will return the host
 * element of the shadow root. Otherwise it will return the parent node or null if
 * no parent node exists.
 * @param element - The element for which to retrieve the composed parent
 *
 * @public
 */
function composedParent(element) {
  const parentNode = element.parentElement;

  if (parentNode) {
    return parentNode;
  } else {
    const rootNode = element.getRootNode();

    if (rootNode.host instanceof HTMLElement) {
      // this is shadow-root
      return rootNode.host;
    }
  }

  return null;
}

/**
 * An abstract behavior to react to media queries. Implementations should implement
 * the `constructListener` method to perform some action based on media query changes.
 *
 * @public
 */
class MatchMediaBehavior {
  /**
   *
   * @param query - The media query to operate from.
   */
  constructor(query) {
    /**
     * The behavior needs to operate on element instances but elements might share a behavior instance.
     * To ensure proper attachment / detachment per instance, we construct a listener for
     * each bind invocation and cache the listeners by element reference.
     */
    this.listenerCache = new WeakMap();
    this.query = query;
  }
  /**
   * Binds the behavior to the element.
   * @param source - The element for which the behavior is bound.
   */


  bind(source) {
    const {
      query
    } = this;
    const listener = this.constructListener(source); // Invoke immediately to add if the query currently matches

    listener.bind(query)();
    query.addListener(listener);
    this.listenerCache.set(source, listener);
  }
  /**
   * Unbinds the behavior from the element.
   * @param source - The element for which the behavior is unbinding.
   */


  unbind(source) {
    const listener = this.listenerCache.get(source);

    if (listener) {
      this.query.removeListener(listener);
      this.listenerCache.delete(source);
    }
  }

}
/**
 * A behavior to add or remove a stylesheet from an element based on a media query. The behavior ensures that
 * styles are applied while the a query matches the environment and that styles are not applied if the query does
 * not match the environment.
 *
 * @public
 */

class MatchMediaStyleSheetBehavior extends MatchMediaBehavior {
  /**
   * Constructs a {@link MatchMediaStyleSheetBehavior} instance.
   * @param query - The media query to operate from.
   * @param styles - The styles to coordinate with the query.
   */
  constructor(query, styles) {
    super(query);
    this.styles = styles;
  }
  /**
   * Defines a function to construct {@link MatchMediaStyleSheetBehavior | MatchMediaStyleSheetBehaviors} for
   * a provided query.
   * @param query - The media query to operate from.
   *
   * @public
   * @example
   *
   * ```ts
   * import { css } from "@microsoft/fast-element";
   * import { MatchMediaStyleSheetBehavior } from "@microsoft/fast-foundation";
   *
   * const landscapeBehavior = MatchMediaStyleSheetBehavior.with(
   *   window.matchMedia("(orientation: landscape)")
   * );
   * const styles = css`
   *   :host {
   *     width: 200px;
   *     height: 400px;
   *   }
   * `
   * .withBehaviors(landscapeBehavior(css`
   *   :host {
   *     width: 400px;
   *     height: 200px;
   *   }
   * `))
   * ```
   */


  static with(query) {
    return styles => {
      return new MatchMediaStyleSheetBehavior(query, styles);
    };
  }
  /**
   * Constructs a match-media listener for a provided element.
   * @param source - the element for which to attach or detach styles.
   * @internal
   */


  constructListener(source) {
    let attached = false;
    const styles = this.styles;
    return function listener() {
      const {
        matches
      } = this;

      if (matches && !attached) {
        source.$fastController.addStyles(styles);
        attached = matches;
      } else if (!matches && attached) {
        source.$fastController.removeStyles(styles);
        attached = matches;
      }
    };
  }
  /**
   * Unbinds the behavior from the element.
   * @param source - The element for which the behavior is unbinding.
   * @internal
   */


  unbind(source) {
    super.unbind(source);
    source.$fastController.removeStyles(this.styles);
  }

}
/**
 * Construct a behavior factory that will conditionally apply a stylesheet based
 * on a MediaQueryList
 *
 * @param query - The MediaQueryList to subscribe to matches for.
 *
 * @public
 * @deprecated - use {@link MatchMediaStyleSheetBehavior.with}
 */

function matchMediaStylesheetBehaviorFactory(query) {
  return MatchMediaStyleSheetBehavior.with(query);
}
/**
 * This can be used to construct a behavior to apply a forced-colors only stylesheet.
 * @public
 */

const forcedColorsStylesheetBehavior = MatchMediaStyleSheetBehavior.with(window.matchMedia("(forced-colors)"));

/**
 * The CSS value for disabled cursors.
 * @public
 */
const disabledCursor = "not-allowed";

/**
 * A CSS fragment to set `display: none;` when the host is hidden using the [hidden] attribute.
 * @public
 */
const hidden = `:host([hidden]){display:none}`;
/**
 * Applies a CSS display property.
 * Also adds CSS rules to not display the element when the [hidden] attribute is applied to the element.
 * @param display - The CSS display property value
 * @public
 */

function display(displayValue) {
  return `${hidden}:host{display:${displayValue}}`;
}

/**
 * The string representing the focus selector to be used. Value
 * will be "focus-visible" when https://drafts.csswg.org/selectors-4/#the-focus-visible-pseudo
 * is supported and "focus" when it is not.
 *
 * @public
 */

const focusVisible = canUseFocusVisible() ? "focus-visible" : "focus";

const supportsAdoptedStylesheets = ("adoptedStyleSheets" in window.ShadowRoot.prototype);
/**
 * Determines if the element is {@link DesignSystemConsumer}
 * @param element - the element to test.
 * @public
 */

function isDesignSystemConsumer(element) {
  const provider = element.provider;
  return provider !== null && provider !== void 0 && DesignSystemProvider.isDesignSystemProvider(provider);
}
/**
 * Behavior to connect a {@link DesignSystemConsumer} to the nearest {@link DesignSystemProvider}
 * @public
 */

const designSystemConsumerBehavior = {
  bind(source) {
    source.provider = DesignSystemProvider.findProvider(source);
  },

  /* eslint-disable-next-line */
  unbind(source) {}

};
/**
 * A element to provide Design System values to consumers via CSS custom properties
 * and to resolve recipe values.
 *
 * @public
 */

class DesignSystemProvider extends FASTElement {
  constructor() {
    super();
    /**
     * Allows other components to identify this as a provider.
     * Using instanceof DesignSystemProvider did not seem to work.
     *
     * @public
     */

    this.isDesignSystemProvider = true;
    /**
     * The design-system object.
     * This is "observable" but will notify on object mutation
     * instead of object assignment
     *
     * @public
     */

    this.designSystem = {};
    /**
     * Applies the default design-system values to the instance where properties
     * are not explicitly assigned. This is generally used to set the root design
     * system context.
     *
     * @public
     * @remarks
     * HTML Attribute: use-defaults
     */

    this.useDefaults = false;
    /**
     * The parent provider the the DesignSystemProvider instance.
     * @public
     */

    this.provider = null;
    /**
     * Stores all CSSCustomPropertyDefinitions registered with the provider.
     */

    this.cssCustomPropertyDefinitions = new Map();
    /**
     * Handle changes to design-system-provider IDL and content attributes
     * that reflect to design-system properties.
     */

    this.attributeChangeHandler = {
      handleChange: (source, key) => {
        const value = this[key];

        if (this.isValidDesignSystemValue(value)) {
          this.designSystem[key] = value;
          const property = this.designSystemProperties[key];

          if (property && property.cssCustomProperty) {
            this.setCustomProperty({
              name: property.cssCustomProperty,
              value
            });
          }
        } else {
          this.syncDesignSystemWithProvider();
          const property = this.designSystemProperties[key].cssCustomProperty;

          if (typeof property === "string") {
            this.deleteCustomProperty(property);
          }

          this.writeCustomProperties();
        }
      }
    };
    /**
     * Handle changes to the local design-system property.
     */

    this.localDesignSystemChangeHandler = {
      handleChange: this.writeCustomProperties.bind(this)
    };
    /**
     * Handle changes to the upstream design-system provider
     */

    this.providerDesignSystemChangeHandler = {
      handleChange: (source, key) => {
        if (source[key] !== this.designSystem[key] && !this.isValidDesignSystemValue(this[key])) {
          this.designSystem[key] = source[key];
        }
      }
    };
    /**
     * Writes a CSS custom property to the design system provider,
     * evaluating any function values with the design system.
     */

    this.setCustomProperty = definition => {
      this.customPropertyTarget.setProperty(`--${definition.name}`, this.evaluate(definition));
    };
    /**
     * Removes a CSS custom property from the provider.
     */


    this.deleteCustomProperty = name => {
      this.customPropertyTarget.removeProperty(`--${name}`);
    };

    if (supportsAdoptedStylesheets && this.shadowRoot !== null) {
      const sheet = new CSSStyleSheet();
      sheet.insertRule(":host{}");
      this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
      this.customPropertyTarget = sheet.rules[0].style;
    } else {
      this.customPropertyTarget = this.style;
    }

    this.$fastController.addBehaviors([designSystemConsumerBehavior]);
  }
  /**
   * Read all tag-names that are associated to
   * design-system-providers
   *
   * @public
   */


  static get tagNames() {
    return DesignSystemProvider._tagNames;
  }
  /**
   * Determines if an element is a DesignSystemProvider
   * @param el - The element to test
   *
   * @public
   */


  static isDesignSystemProvider(el) {
    return el.isDesignSystemProvider || DesignSystemProvider.tagNames.indexOf(el.tagName) !== -1;
  }
  /**
   * Finds the closest design-system-provider
   * to an element.
   *
   * @param el - The element from which to begin searching.
   * @public
   */


  static findProvider(el) {
    if (isDesignSystemConsumer(el)) {
      return el.provider;
    }

    let parent = composedParent(el);

    while (parent !== null) {
      if (DesignSystemProvider.isDesignSystemProvider(parent)) {
        el.provider = parent; // Store provider on ourselves for future reference

        return parent;
      } else if (isDesignSystemConsumer(parent)) {
        el.provider = parent.provider;
        return parent.provider;
      } else {
        parent = composedParent(parent);
      }
    }

    return null;
  }
  /**
   * Registers a tag-name to be associated with
   * the design-system-provider class. All tag-names for DesignSystemProvider elements
   * must be registered for proper property resolution.
   *
   * @param tagName - the HTML Element tag name to register as a DesignSystemProvider.
   *
   * @public
   */


  static registerTagName(tagName) {
    const tagNameUpper = tagName.toUpperCase();

    if (DesignSystemProvider.tagNames.indexOf(tagNameUpper) === -1) {
      DesignSystemProvider._tagNames.push(tagNameUpper);
    }
  }

  useDefaultsChanged() {
    if (this.useDefaults) {
      const props = this.designSystemProperties;
      Object.keys(props).forEach(key => {
        if (this[key] === void 0) {
          this[key] = props[key].default;
        }
      });
    }
  }

  providerChanged(prev, next) {
    if (prev instanceof HTMLElement) {
      Object.keys(prev.designSystemProperties).forEach(key => {
        Observable.getNotifier(prev.designSystem).unsubscribe(this.providerDesignSystemChangeHandler, key);
      });
    }

    if (next instanceof HTMLElement && DesignSystemProvider.isDesignSystemProvider(next)) {
      Object.keys(next.designSystemProperties).forEach(key => {
        Observable.getNotifier(next.designSystem).subscribe(this.providerDesignSystemChangeHandler, key);
      });
      this.syncDesignSystemWithProvider();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    const selfNotifier = Observable.getNotifier(this);
    const designSystemNotifier = Observable.getNotifier(this.designSystem);
    Object.keys(this.designSystemProperties).forEach(property => {
      observable(this.designSystem, property);
      selfNotifier.subscribe(this.attributeChangeHandler, property); // Notify ourselves when properties related to DS change

      designSystemNotifier.subscribe(this.localDesignSystemChangeHandler, property); // Notify ourselves when design system properties change

      const value = this[property]; // If property is set then put it onto the design system

      if (this.isValidDesignSystemValue(value)) {
        this.designSystem[property] = value;
        const {
          cssCustomProperty
        } = this.designSystemProperties[property];

        if (typeof cssCustomProperty === "string") {
          this.setCustomProperty({
            name: cssCustomProperty,
            value
          });
        }
      }
    }); // Register all properties that may have been attached before construction

    if (Array.isArray(this.disconnectedCSSCustomPropertyRegistry)) {
      for (let i = 0; i < this.disconnectedCSSCustomPropertyRegistry.length; i++) {
        this.registerCSSCustomProperty(this.disconnectedCSSCustomPropertyRegistry[i]);
      }

      delete this.disconnectedCSSCustomPropertyRegistry;
    }
  }
  /**
   * Register a {@link @microsoft/fast-foundation#CSSCustomPropertyDefinition} with the DeignSystemProvider.
   * Registering a {@link @microsoft/fast-foundation#CSSCustomPropertyDefinition} will create the CSS custom property.
   *
   * @param behavior - The {@link @microsoft/fast-foundation#CSSCustomPropertyDefinition} to register.
   * @public
   */


  registerCSSCustomProperty(behavior) {
    const cached = this.cssCustomPropertyDefinitions.get(behavior.name);

    if (cached) {
      cached.count += 1;
    } else {
      this.cssCustomPropertyDefinitions.set(behavior.name, Object.assign(Object.assign({}, behavior), {
        count: 1
      }));
      this.setCustomProperty(behavior);
    }
  }
  /**
   * Unregister a {@link @microsoft/fast-foundation#CSSCustomPropertyDefinition} from the DeignSystemProvider.
   * If all registrations of the definition are unregistered, the CSS custom property will be removed.
   *
   * @param behavior - The {@link @microsoft/fast-foundation#CSSCustomPropertyDefinition} to register.
   * @public
   */


  unregisterCSSCustomProperty(behavior) {
    const cached = this.cssCustomPropertyDefinitions.get(behavior.name);

    if (cached) {
      cached.count -= 1;

      if (cached.count === 0) {
        this.cssCustomPropertyDefinitions.delete(behavior.name);
        this.deleteCustomProperty(behavior.name);
      }
    }
  }
  /**
   * Writes all CSS custom property definitions to the design system provider.
   */


  writeCustomProperties() {
    this.cssCustomPropertyDefinitions.forEach(this.setCustomProperty);
  }
  /**
   * Evaluates a CSSCustomPropertyDefinition with the current design system.
   *
   * @public
   */


  evaluate(definition) {
    return typeof definition.value === "function" ? // use spread on the designSystem object to circumvent memoization
    // done in the color recipes - we use the same *reference* in WC
    // for performance improvements but that throws off the recipes
    // We should look at making the recipes use simple args that
    // we can individually memoize.
    definition.value(Object.assign({}, this.designSystem)) : definition.value;
  }
  /**
   * Synchronize the provider's design system with the local
   * overrides. Any value defined on the instance will take priority
   * over the value defined by the provider
   */


  syncDesignSystemWithProvider() {
    if (this.provider) {
      const designProperties = this.designSystemProperties;
      Object.keys(designProperties).forEach(key => {
        const property = designProperties[key];

        if (!this.isValidDesignSystemValue(property)) {
          this.designSystem[key] = this.provider.designSystem[key];
        }
      });
    }
  }

  isValidDesignSystemValue(value) {
    return value !== void 0 && value !== null;
  }

}
/**
 * Stores a list of all element tag-names that associated
 * to design-system-providers
 */

DesignSystemProvider._tagNames = [];

__decorate([attr({
  attribute: "use-defaults",
  mode: "boolean"
})], DesignSystemProvider.prototype, "useDefaults", void 0);

__decorate([observable], DesignSystemProvider.prototype, "provider", void 0);
/**
 * Defines a design-system-provider custom element, registering the tag-name so that the element can be property resolved by {@link DesignSystemConsumer | DesignSystemConsumers}.
 *
 * @param nameOrDef - the name or {@link @microsoft/fast-element#PartialFASTElementDefinition | element definition}
 * @public
 */


function designSystemProvider(nameOrDef) {
  return providerCtor => {
    customElement(nameOrDef)(providerCtor);
    providerCtor.registerTagName(typeof nameOrDef === "string" ? nameOrDef : nameOrDef.name);
  };
}

/**
 * Decorator to declare a property as a design-system property.
 * Intended to be used with the {@link @microsoft/fast-foundation#DesignSystemProvider}
 * @param config - {@link DecoratorDesignSystemPropertyConfiguration}
 *
 * @public
 */

function designSystemProperty(config) {
  const decorator = (source, prop, config) => {
    const {
      cssCustomProperty,
      attribute
    } = config;

    if (!source.designSystemProperties) {
      source.designSystemProperties = {};
    }

    if (attribute === false) {
      observable(source, prop);
    } else {
      /**
       * Default to fromView so we don't perform un-necessary DOM writes
       */
      if (config.mode === void 0) {
        config = Object.assign(Object.assign({}, config), {
          mode: "fromView"
        });
      }

      attr(config)(source, prop);
    }

    source.designSystemProperties[prop] = {
      cssCustomProperty: cssCustomProperty === false ? false : typeof cssCustomProperty === "string" ? cssCustomProperty : typeof attribute === "string" ? attribute : prop,
      default: config.default
    };
  };

  return (source, prop) => {
    decorator(source, prop, config);
  };
}

/**
 * The template for the {@link @microsoft/fast-foundation#DesignSystemProvider} component.
 * @public
 */

const DesignSystemProviderTemplate = html`<slot></slot>`;

/**
 * The template for the {@link @microsoft/fast-foundation#Dialog} component.
 * @public
 */

const DialogTemplate = html`<div class="positioning-region" part="positioning-region">${when(x => x.modal, html`<div class="overlay" part="overlay" role="presentation" tabindex="-1" @click="${x => x.dismiss()}"></div>`)}<div role="dialog" class="control" part="control" aria-modal="${x => x.modal}" aria-describedby="${x => x.ariaDescribedby}" aria-labelledby="${x => x.ariaLabelledby}" aria-label="${x => x.ariaLabel}" ${ref("dialog")}><slot></slot></div></div>`;

var candidateSelectors = ['input', 'select', 'textarea', 'a[href]', 'button', '[tabindex]', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])'];
var candidateSelector = candidateSelectors.join(',');
var matches = typeof Element === 'undefined' ? function () {} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;

function tabbable(el, options) {
  options = options || {};
  var regularTabbables = [];
  var orderedTabbables = [];
  var candidates = el.querySelectorAll(candidateSelector);

  if (options.includeContainer) {
    if (matches.call(el, candidateSelector)) {
      candidates = Array.prototype.slice.apply(candidates);
      candidates.unshift(el);
    }
  }

  var i, candidate, candidateTabindex;

  for (i = 0; i < candidates.length; i++) {
    candidate = candidates[i];
    if (!isNodeMatchingSelectorTabbable(candidate)) continue;
    candidateTabindex = getTabindex(candidate);

    if (candidateTabindex === 0) {
      regularTabbables.push(candidate);
    } else {
      orderedTabbables.push({
        documentOrder: i,
        tabIndex: candidateTabindex,
        node: candidate
      });
    }
  }

  var tabbableNodes = orderedTabbables.sort(sortOrderedTabbables).map(function (a) {
    return a.node;
  }).concat(regularTabbables);
  return tabbableNodes;
}

tabbable.isTabbable = isTabbable;
tabbable.isFocusable = isFocusable;

function isNodeMatchingSelectorTabbable(node) {
  if (!isNodeMatchingSelectorFocusable(node) || isNonTabbableRadio(node) || getTabindex(node) < 0) {
    return false;
  }

  return true;
}

function isTabbable(node) {
  if (!node) throw new Error('No node provided');
  if (matches.call(node, candidateSelector) === false) return false;
  return isNodeMatchingSelectorTabbable(node);
}

function isNodeMatchingSelectorFocusable(node) {
  if (node.disabled || isHiddenInput(node) || isHidden(node)) {
    return false;
  }

  return true;
}

var focusableCandidateSelector = candidateSelectors.concat('iframe').join(',');

function isFocusable(node) {
  if (!node) throw new Error('No node provided');
  if (matches.call(node, focusableCandidateSelector) === false) return false;
  return isNodeMatchingSelectorFocusable(node);
}

function getTabindex(node) {
  var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);
  if (!isNaN(tabindexAttr)) return tabindexAttr; // Browsers do not return `tabIndex` correctly for contentEditable nodes;
  // so if they don't have a tabindex attribute specifically set, assume it's 0.

  if (isContentEditable(node)) return 0;
  return node.tabIndex;
}

function sortOrderedTabbables(a, b) {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
}

function isContentEditable(node) {
  return node.contentEditable === 'true';
}

function isInput(node) {
  return node.tagName === 'INPUT';
}

function isHiddenInput(node) {
  return isInput(node) && node.type === 'hidden';
}

function isRadio(node) {
  return isInput(node) && node.type === 'radio';
}

function isNonTabbableRadio(node) {
  return isRadio(node) && !isTabbableRadio(node);
}

function getCheckedRadio(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked) {
      return nodes[i];
    }
  }
}

function isTabbableRadio(node) {
  if (!node.name) return true; // This won't account for the edge case where you have radio groups with the same
  // in separate forms on the same page.

  var radioSet = node.ownerDocument.querySelectorAll('input[type="radio"][name="' + node.name + '"]');
  var checked = getCheckedRadio(radioSet);
  return !checked || checked === node;
}

function isHidden(node) {
  // offsetParent being null will allow detecting cases where an element is invisible or inside an invisible element,
  // as long as the element does not use position: fixed. For them, their visibility has to be checked directly as well.
  return node.offsetParent === null || getComputedStyle(node).visibility === 'hidden';
}

var tabbable_1 = tabbable;

/**
 * A Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#dialog | ARIA dialog }.
 *
 * @public
 */

class Dialog extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * Indicates the element is modal. When modal, user interaction will be limited to the contents of the element.
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: modal
     */

    this.modal = true;
    /**
     * The hidden state of the element.
     *
     * @public
     * @defaultValue - false
     * @remarks
     * HTML Attribute: hidden
     */

    this.hidden = false;
    /**
     * Indicates that the dialog should trap focus.
     *
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: trap-focus
     */

    this.trapFocus = true;

    this.trapFocusChanged = () => {
      if (this.shouldDialogTrapFocus()) {
        // Add an event listener for focusin events if we should be trapping focus
        document.addEventListener("focusin", this.handleDocumentFocus); // determine if we should move focus inside the dialog

        if (this.shouldForceFocus(document.activeElement)) {
          this.focusFirstElement();
        }
      } else {
        // remove event listener if we are not trapping focus
        document.removeEventListener("focusin", this.handleDocumentFocus);
      }
    };

    this.handleDocumentKeydown = e => {
      if (!e.defaultPrevented && !this.isDialogHidden()) {
        switch (e.keyCode) {
          case keyCodeEscape:
            this.dismiss();
            break;

          case keyCodeTab:
            this.handleTabKeyDown(e);
            break;
        }
      }
    };

    this.handleDocumentFocus = e => {
      if (!e.defaultPrevented && this.shouldForceFocus(e.target)) {
        this.focusFirstElement();
        e.preventDefault();
      }
    };

    this.handleTabKeyDown = e => {
      if (!this.shouldDialogTrapFocus()) {
        return;
      }

      const tabbableElementCount = this.tabbableElements.length;

      if (tabbableElementCount === 0) {
        this.dialog.focus();
        e.preventDefault();
        return;
      }

      if (e.shiftKey && e.target === this.tabbableElements[0]) {
        this.tabbableElements[tabbableElementCount - 1].focus();
        e.preventDefault();
      } else if (!e.shiftKey && e.target === this.tabbableElements[tabbableElementCount - 1]) {
        this.tabbableElements[0].focus();
        e.preventDefault();
      }
    };
    /**
     * focus on first element of tab queue
     */


    this.focusFirstElement = () => {
      if (this.tabbableElements.length === 0) {
        this.dialog.focus();
      } else {
        this.tabbableElements[0].focus();
      }
    };
    /**
     * we should only focus if focus has not already been brought to the dialog
     */


    this.shouldForceFocus = currentFocusElement => {
      return !this.isDialogHidden() && !this.contains(currentFocusElement);
    };
  }
  /**
   * @internal
   */


  dismiss() {
    this.$emit("dismiss");
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback(); // store references to tabbable elements

    this.tabbableElements = tabbable_1(this);
    this.observer = new MutationObserver(this.onChildListChange); // only observe if nodes are added or removed

    this.observer.observe(this, {
      childList: true
    });
    document.addEventListener("keydown", this.handleDocumentKeydown); // Ensure the DOM is updated
    // This helps avoid a delay with `autofocus` elements recieving focus

    DOM.queueUpdate(this.trapFocusChanged);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback(); // disconnect observer

    this.observer.disconnect(); // remove keydown event listener

    document.removeEventListener("keydown", this.handleDocumentKeydown); // if we are trapping focus remove the focusin listener

    if (this.shouldDialogTrapFocus()) {
      document.removeEventListener("focusin", this.handleDocumentFocus);
    }
  }

  onChildListChange(mutations,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  observer) {
    if (mutations.length) {
      this.tabbableElements = tabbable_1(this);
    }
  }
  /**
   * TODO: Issue #2742 - https://github.com/microsoft/fast/issues/2742
   * This is a placeholder function to check if the hidden attribute is present
   * Currently there is not support for boolean attributes.
   * Once support is added, we will simply use this.hidden.
   */


  isDialogHidden() {
    return typeof this.hidden !== "boolean";
  }
  /**
   * TODO: Issue #2742 - https://github.com/microsoft/fast/issues/2742
   * This is a placeholder function to check if the trapFocus attribute is present
   * Currently there is not support for boolean attributes.
   * Once support is added, we will simply use this.trapFocus.
   */


  shouldDialogTrapFocus() {
    return typeof this.trapFocus === "boolean";
  }

}

__decorate([attr({
  mode: "boolean"
})], Dialog.prototype, "modal", void 0);

__decorate([attr({
  mode: "boolean"
})], Dialog.prototype, "hidden", void 0);

__decorate([attr({
  attribute: "trap-focus",
  mode: "boolean"
})], Dialog.prototype, "trapFocus", void 0);

__decorate([attr({
  attribute: "aria-describedby"
})], Dialog.prototype, "ariaDescribedby", void 0);

__decorate([attr({
  attribute: "aria-labelledby"
})], Dialog.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-label"
})], Dialog.prototype, "ariaLabel", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Divider} component.
 * @public
 */

const DividerTemplate = html`<template role="${x => x.role}"></template>`;

/**
 * Divider roles
 * @public
 */

var DividerRole;

(function (DividerRole) {
  /**
   * The divider semantically separates content
   */
  DividerRole["separator"] = "separator";
  /**
   * The divider has no semantic value and is for visual presentation only.
   */

  DividerRole["presentation"] = "presentation";
})(DividerRole || (DividerRole = {}));
/**
 * A Divider Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#separator | ARIA separator } or {@link https://www.w3.org/TR/wai-aria-1.1/#presentation | ARIA presentation}.
 *
 * @public
 */


class Divider extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * The role of the element.
     *
     * @public
     * @defaultValue - {@link DividerRole.separator}
     * @remarks
     * HTML Attribute: role
     */

    this.role = DividerRole.separator;
  }

}

__decorate([attr], Divider.prototype, "role", void 0);

/**
 * The direction options for flipper.
 * @public
 */

var FlipperDirection;

(function (FlipperDirection) {
  FlipperDirection["next"] = "next";
  FlipperDirection["previous"] = "previous";
})(FlipperDirection || (FlipperDirection = {}));
/**
 * A Flipper Custom HTML Element.
 * Flippers are a form of button that implies directional content navigation, such as in a carousel.
 *
 * @public
 */


class Flipper extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * Indicates the flipper should be hidden from assistive technology. Because flippers are often supplementary navigation, they are often hidden from assistive technology.
     *
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: aria-hidden
     */

    this.hiddenFromAT = true;
    /**
     * The direction that the flipper implies navigating.
     *
     * @public
     * @remarks
     * HTML Attribute: direction
     */

    this.direction = FlipperDirection.next;
  }

}

__decorate([attr({
  mode: "boolean"
})], Flipper.prototype, "disabled", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  converter: booleanConverter
})], Flipper.prototype, "hiddenFromAT", void 0);

__decorate([attr], Flipper.prototype, "direction", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Flipper} component.
 * @public
 */

const FlipperTemplate = html`<template role="button" aria-disabled="${x => x.disabled ? true : void 0}" tabindex="${x => x.hiddenFromAT ? -1 : 0}" class="${x => x.direction} ${x => x.disabled ? "disabled" : ""}">${when(x => x.direction === FlipperDirection.next, html`<span part="next" class="next"><slot name="next"><svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4.023 15.273L11.29 8 4.023.727l.704-.704L12.71 8l-7.984 7.977-.704-.704z" /></svg></slot></span>`)} ${when(x => x.direction === FlipperDirection.previous, html`<span part="previous" class="previous"><slot name="previous"><svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M11.273 15.977L3.29 8 11.273.023l.704.704L4.71 8l7.266 7.273-.704.704z" /></svg></slot></span>`)}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#Menu} component.
 * @public
 */

const MenuTemplate = html`<template role="menu" @keydown="${(x, c) => x.handleMenuKeyDown(c.event)}" @focusout="${(x, c) => x.handleFocusOut(c.event)}"><slot ${slotted("items")}></slot></template>`;

/**
 * Menu items roles.
 * @public
 */

var MenuItemRole;

(function (MenuItemRole) {
  MenuItemRole["menuitem"] = "menuitem";
  MenuItemRole["menuitemcheckbox"] = "menuitemcheckbox";
  MenuItemRole["menuitemradio"] = "menuitemradio";
})(MenuItemRole || (MenuItemRole = {}));
/**
 * A Switch Custom HTML Element.
 * Implements {@link https://www.w3.org/TR/wai-aria-1.1/#menuitem | ARIA menuitem }, {@link https://www.w3.org/TR/wai-aria-1.1/#menuitemcheckbox | ARIA menuitemcheckbox}, or {@link https://www.w3.org/TR/wai-aria-1.1/#menuitemradio | ARIA menuitemradio }.
 *
 * @public
 */


class MenuItem extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * The role of the element.
     *
     * @public
     * @remarks
     * HTML Attribute: role
     */

    this.role = MenuItemRole.menuitem;
    /**
     * @internal
     */

    this.handleMenuItemKeyDown = e => {
      switch (e.keyCode) {
        case keyCodeEnter:
        case keyCodeSpace:
          this.invoke();
          return false;
      }

      return true;
    };
    /**
     * @internal
     */


    this.handleMenuItemClick = e => {
      this.invoke();
    };

    this.invoke = () => {
      if (this.disabled) {
        return;
      }

      switch (this.role) {
        case MenuItemRole.menuitemcheckbox:
        case MenuItemRole.menuitemradio:
          this.checked = !this.checked;
          break;
      }

      this.$emit("change");
    };
  }

}

__decorate([attr({
  mode: "boolean"
})], MenuItem.prototype, "disabled", void 0);

__decorate([attr({
  attribute: "expanded"
})], MenuItem.prototype, "expanded", void 0);

__decorate([attr], MenuItem.prototype, "role", void 0);

__decorate([attr], MenuItem.prototype, "checked", void 0);

applyMixins(MenuItem, StartEnd);

/**
 * The template for the {@link @microsoft/fast-foundation#(MenuItem:class)} component.
 * @public
 */

const MenuItemTemplate = html`<template role="${x => x.role}" aria-checked="${x => x.role !== MenuItemRole.menuitem ? x.checked : void 0}" aria-disabled="${x => x.disabled}" aria-expanded="${x => x.expanded}" @keydown="${(x, c) => x.handleMenuItemKeyDown(c.event)}" @click="${(x, c) => x.handleMenuItemClick(c.event)}" class="${x => x.disabled ? "disabled" : ""} ${x => x.expanded ? "expanded" : ""}">${startTemplate}<span class="content" part="content"><slot></slot></span>${endTemplate}</template>`;

/**
 * A Menu Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#menu | ARIA menu }.
 *
 * @public
 */

class Menu extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * The index of the focusable element in the items array
     * defaults to -1
     */

    this.focusIndex = -1;
    /**
     * if focus is moving out of the menu, reset to a stable initial state
     * @internal
     */

    this.handleFocusOut = e => {
      const isNestedEl = this.contains(e.relatedTarget);

      if (!isNestedEl) {
        // find our first focusable element
        const focusIndex = this.menuItems.findIndex(this.isFocusableElement); // set the current focus index's tabindex to -1

        this.menuItems[this.focusIndex].setAttribute("tabindex", ""); // set the first focusable element tabindex to 0

        this.menuItems[focusIndex].setAttribute("tabindex", "0"); // set the focus index

        this.focusIndex = focusIndex;
      }
    };

    this.setItems = () => {
      const focusIndex = this.menuItems.findIndex(this.isFocusableElement); // if our focus index is not -1 we have items

      if (focusIndex !== -1) {
        this.focusIndex = focusIndex;
      }

      for (let item = 0; item < this.menuItems.length; item++) {
        if (item === focusIndex) {
          this.menuItems[item].setAttribute("tabindex", "0");
        }

        this.menuItems[item].addEventListener("blur", this.handleMenuItemFocus);
      }
    };

    this.resetItems = oldValue => {
      for (let item = 0; item < oldValue.length; item++) {
        oldValue[item].removeEventListener("blur", this.handleMenuItemFocus);
      }
    };
    /**
     * check if the item is a menu item
     */


    this.isMenuItemElement = el => {
      return isHTMLElement(el) && Menu.focusableElementRoles.hasOwnProperty(el.getAttribute("role"));
    };
    /**
     * check if the item is disabled
     */


    this.isDisabledElement = el => {
      return this.isMenuItemElement(el) && el.getAttribute("aria-disabled") === "true";
    };
    /**
     * check if the item is focusable
     */


    this.isFocusableElement = el => {
      return this.isMenuItemElement(el) && !this.isDisabledElement(el);
    };

    this.handleMenuItemFocus = e => {
      const target = e.currentTarget;
      const focusIndex = this.menuItems.indexOf(target);

      if (this.isDisabledElement(target)) {
        target.blur();
        return;
      }

      if (focusIndex !== this.focusIndex && focusIndex !== -1) {
        this.setFocus(focusIndex, focusIndex > this.focusIndex ? 1 : -1);
      }
    };
  }

  itemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.menuItems = this.domChildren();
      this.resetItems(oldValue);
      this.setItems();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.menuItems = this.domChildren();
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.menuItems = [];
  }
  /**
   * Focuses the first item in the menu.
   *
   * @public
   */


  focus() {
    this.setFocus(0, 1);
  }
  /**
   * @internal
   */


  handleMenuKeyDown(e) {
    if (e.defaultPrevented) {
      return;
    }

    switch (e.keyCode) {
      case keyCodeArrowDown:
      case keyCodeArrowRight:
        // go forward one index
        this.setFocus(this.focusIndex + 1, 1);
        return;

      case keyCodeArrowUp:
      case keyCodeArrowLeft:
        // go back one index
        this.setFocus(this.focusIndex - 1, -1);
        return;

      case keyCodeEnd:
        // set focus on last item
        this.setFocus(this.domChildren().length - 1, -1);
        return;

      case keyCodeHome:
        // set focus on first item
        this.setFocus(0, 1);
        return;

      default:
        // if we are not handling the event, do not prevent default
        return true;
    }
  }
  /**
   * get an array of valid DOM children
   */


  domChildren() {
    return Array.from(this.children);
  }

  setFocus(focusIndex, adjustment) {
    const children = this.menuItems;

    while (inRange(focusIndex, children.length)) {
      const child = children[focusIndex];

      if (this.isFocusableElement(child)) {
        // update the tabindex of next focusable element
        child.setAttribute("tabindex", "0"); // focus the element

        child.focus(); // change the previous index to -1

        children[this.focusIndex].setAttribute("tabindex", ""); // update the focus index

        this.focusIndex = focusIndex;
        break;
      }

      focusIndex += adjustment;
    }
  }

}
Menu.focusableElementRoles = invert(MenuItemRole);

__decorate([observable], Menu.prototype, "items", void 0);

/**
 * An Progress HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#progressbar | ARIA progressbar }.
 *
 * @public
 */

class BaseProgress extends FASTElement {}

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "value", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "min", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "max", void 0);

__decorate([attr({
  mode: "boolean"
})], BaseProgress.prototype, "paused", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#BaseProgress} component.
 * @public
 */

const ProgressTemplate = html`<template role="progressbar" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" class="${x => x.paused ? "paused" : ""}">${when(x => x.value, html`<div class="progress" part="progress" slot="determinate"><div class="determinate" part="determinate" style="width:${x => x.value}%"></div></div>`)} ${when(x => !x.value, html`<div class="progress" part="progress" slot="indeterminate"><slot class="indeterminate" name="indeterminate"><span class="indeterminate-indicator-1" part="indeterminate-indicator-1"></span><span class="indeterminate-indicator-2" part="indeterminate-indicator-2"></span></slot></div>`)}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#BaseProgress} component.
 * @public
 */

const ProgressRingTemplate = html`<template role="progressbar" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" class="${x => x.paused ? "paused" : ""}">${when(x => x.value, html`<svg class="progress" part="progress" viewBox="0 0 16 16" slot="determinate"><circle class="background" part="background" cx="8px" cy="8px" r="7px"></circle><circle class="determinate" part="determinate" style="stroke-dasharray:${x => 44 * x.value / 100}px 44px" cx="8px" cy="8px" r="7px"></circle></svg>`)} ${when(x => !x.value, html`<slot name="indeterminate" slot="indeterminate"><svg class="progress" part="progress" viewBox="0 0 16 16"><circle class="background" part="background" cx="8px" cy="8px" r="7px"></circle><circle class="indeterminate-indicator-1" part="indeterminate-indicator-1" cx="8px" cy="8px" r="7px"></circle></svg></slot>`)}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#Radio} component.
 * @public
 */

const RadioTemplate = html`<template role="radio" class="${x => x.checked ? "checked" : ""} ${x => x.readOnly ? "readonly" : ""}" aria-checked="${x => x.checked}" aria-required="${x => x.required}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}"><div part="control" class="control"><slot name="checked-indicator"><div part="checked-indicator" class="checked-indicator"></div></slot></div><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label></template>`;

/**
 * An Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#switch | ARIA switch }.
 *
 * @public
 */

class Radio extends FormAssociated {
  constructor() {
    super(...arguments);
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="radio"]
     *
     * @public
     */

    this.value = "on"; // Map to proxy element.

    /**
     * Initialized to the value of the checked attribute. Can be changed independently of the "checked" attribute,
     * but changing the "checked" attribute always additionally sets this value.
     *
     * @public
     */

    this.defaultChecked = !!this.checkedAttribute;
    /**
     * The checked state of the control
     *
     * @public
     */

    this.checked = this.defaultChecked;
    this.proxy = document.createElement("input");
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input radios
     */

    this.dirtyChecked = false;
    /**
     * @internal
     */

    this.keypressHandler = e => {
      super.keypressHandler(e);

      switch (e.keyCode) {
        case keyCodeSpace:
          if (!this.checked && !this.readOnly) {
            this.checked = true;
          }

          break;
      }
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly) {
        this.checked = !this.checked;
      }
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  nameChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.name = this.name;
    }
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    if (!this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      this.checked = this.defaultChecked;
      this.dirtyChecked = false;
    }
  }

  checkedChanged() {
    if (!this.dirtyChecked) {
      this.dirtyChecked = true;
    }

    if (this.proxy instanceof HTMLElement) {
      this.proxy.checked = this.checked;
    }

    this.$emit("change");
    this.checkedAttribute = this.checked;
    this.updateForm();
  }
  /**
   * @internal
   */


  connectedCallback() {
    var _a;

    super.connectedCallback();
    this.proxy.setAttribute("type", "radio");

    if (((_a = this.parentElement) === null || _a === void 0 ? void 0 : _a.getAttribute("role")) !== "radiogroup" && this.getAttribute("tabindex") === null) {
      if (!this.disabled) {
        this.setAttribute("tabindex", "0");
      }
    }

    this.updateForm();
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Radio.prototype, "readOnly", void 0);

__decorate([attr], Radio.prototype, "name", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Radio.prototype, "checkedAttribute", void 0);

__decorate([observable], Radio.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Radio.prototype, "defaultChecked", void 0);

__decorate([observable], Radio.prototype, "checked", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#RadioGroup} component.
 * @public
 */

const RadioGroupTemplate = html`<template role="radiogroup" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}"><slot name="label"></slot><div class="positioning-region ${x => x.orientation === Orientation.horizontal ? "horizontal" : "vertical"}" part="positioning-region"><slot ${slotted("slottedRadioButtons")}></slot></div></template>`;

/**
 * An Radio Group Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#radiogroup | ARIA radiogroup }.
 *
 * @public
 */

class RadioGroup extends FASTElement {
  constructor() {
    super();
    /**
     * The orientation of the group
     *
     * @public
     * @remarks
     * HTML Attribute: orientation
     */

    this.orientation = Orientation.horizontal;
    this.isInsideToolbar = false;

    this.getFilteredRadioButtons = () => {
      const radioButtons = [];

      if (this.slottedRadioButtons !== undefined) {
        this.slottedRadioButtons.forEach(item => {
          if (item instanceof HTMLElement) {
            radioButtons.push(item);
          }
        });
      }

      return radioButtons;
    };

    this.keypressHandler = e => {
      const radio = e.target;

      if (radio) {
        radio.setAttribute("tabindex", radio.checked ? "0" : "-1");
      }
    };

    this.radioChangeHandler = e => {
      const changedRadio = e.target;

      if (changedRadio.checked) {
        this.getFilteredRadioButtons().forEach(radio => {
          if (radio !== changedRadio) {
            radio.checked = false;
            radio.setAttribute("tabindex", "-1");
          }
        });
        this.selectedRadio = changedRadio;
        this.value = changedRadio.value;
      }
    };

    this.moveToRadioByIndex = (group, index) => {
      const radio = group[index];

      if (!this.isInsideToolbar) {
        radio.setAttribute("tabindex", "0");

        if (radio.readOnly) {
          this.getFilteredRadioButtons().forEach(nextRadio => {
            if (nextRadio !== radio) {
              nextRadio.setAttribute("tabindex", "-1");
            }
          });
        } else {
          radio.checked = true;
          this.selectedRadio = radio;
        }
      }

      this.focusedRadio = radio;
      radio.focus();
    };

    this.moveRightOffGroup = () => {
      this.nextElementSibling.focus();
    };

    this.moveLeftOffGroup = () => {
      this.previousElementSibling.focus();
    };
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */


    this.focusOutHandler = e => {
      const group = this.getFilteredRadioButtons();
      const radio = e.target;
      const index = radio !== null ? group.indexOf(radio) : 0;
      const focusedIndex = this.focusedRadio ? group.indexOf(this.focusedRadio) : -1;

      if (focusedIndex === 0 && index === focusedIndex || focusedIndex === group.length - 1 && focusedIndex === index) {
        if (!this.selectedRadio) {
          this.focusedRadio = group[0];
          this.focusedRadio.setAttribute("tabindex", "0");
          group.forEach(nextRadio => {
            if (nextRadio !== this.focusedRadio) {
              nextRadio.setAttribute("tabindex", "-1");
            }
          });
        } else {
          this.selectedRadio.setAttribute("tabindex", "0");
          this.focusedRadio = this.selectedRadio;
          group.forEach(nextRadio => {
            if (nextRadio !== this.selectedRadio) {
              nextRadio.setAttribute("tabindex", "-1");
            }
          });
        }
      }
    };

    this.clickHandler = e => {
      const radio = e.target;

      if (radio) {
        const group = this.getFilteredRadioButtons();

        if (radio.checked || group.indexOf(radio) === 0) {
          radio.setAttribute("tabindex", "0");
          this.selectedRadio = radio;
        } else {
          radio.setAttribute("tabindex", "-1");
          this.selectedRadio = null;
        }

        this.focusedRadio = radio;
      }

      e.preventDefault();
    };

    this.shouldMoveOffGroupToTheRight = (index, group, keyCode) => {
      return index === group.length && this.isInsideToolbar && keyCode === keyCodeArrowRight;
    };

    this.shouldMoveOffGroupToTheLeft = (group, keyCode) => {
      const index = this.focusedRadio ? group.indexOf(this.focusedRadio) - 1 : 0;
      return index < 0 && this.isInsideToolbar && keyCode === keyCodeArrowLeft;
    };

    this.checkFocusedRadio = () => {
      if (this.focusedRadio !== null && !this.focusedRadio.readOnly && !this.focusedRadio.checked) {
        this.focusedRadio.checked = true;
        this.focusedRadio.setAttribute("tabindex", "0");
        this.focusedRadio.focus();
        this.selectedRadio = this.focusedRadio;
      }
    };
    /**
     * keyboard handling per https://w3c.github.io/aria-practices/#for-radio-groups-not-contained-in-a-toolbar
     * navigation is different when there is an ancestor with role='toolbar'
     *
     * @internal
     */


    this.keydownHandler = e => {
      const group = this.getFilteredRadioButtons();
      let index = 0;

      if (e.keyCode !== keyCodeTab) {
        e.preventDefault();
      }

      switch (e.keyCode) {
        case keyCodeEnter:
          this.checkFocusedRadio();
          break;

        case keyCodeArrowRight:
        case keyCodeArrowDown:
          index = this.focusedRadio ? group.indexOf(this.focusedRadio) + 1 : 1;

          if (this.shouldMoveOffGroupToTheRight(index, group, e.keyCode)) {
            this.moveRightOffGroup();
            return;
          } else if (index === group.length) {
            index = 0;
          }
          /* looping to get to next radio that is not disabled */

          /* matching native radio/radiogroup which does not select an item if there is only 1 in the group */


          while (index < group.length && group.length > 1) {
            if (!group[index].disabled) {
              this.moveToRadioByIndex(group, index);
              break;
            } else if (this.focusedRadio && index === group.indexOf(this.focusedRadio)) {
              break;
            } else if (index + 1 >= group.length) {
              if (this.isInsideToolbar) {
                break;
              } else {
                index = 0;
              }
            } else {
              index += 1;
            }
          }

          break;

        case keyCodeArrowLeft:
        case keyCodeArrowUp:
          if (this.shouldMoveOffGroupToTheLeft(group, e.keyCode)) {
            this.moveLeftOffGroup();
            return;
          }

          index = this.focusedRadio ? group.indexOf(this.focusedRadio) - 1 : 0;
          index = index < 0 ? group.length - 1 : index;
          /* looping to get to next radio that is not disabled */

          while (index >= 0 && group.length > 1) {
            if (!group[index].disabled) {
              this.moveToRadioByIndex(group, index);
              break;
            } else if (this.focusedRadio && index === group.indexOf(this.focusedRadio)) {
              break;
            } else if (index - 1 < 0) {
              index = group.length - 1;
            } else {
              index -= 1;
            }
          }

          break;
      }
    };

    this.addEventListener("keydown", this.keydownHandler);
    this.addEventListener("change", this.radioChangeHandler);
    this.addEventListener("keypress", this.keypressHandler);
    this.addEventListener("click", this.clickHandler);
    this.addEventListener("focusout", this.focusOutHandler);
  }

  readOnlyChanged() {
    const filteredRadios = this.getFilteredRadioButtons();

    if (filteredRadios !== undefined) {
      filteredRadios.forEach(radio => {
        if (this.readOnly) {
          radio.readOnly = true;
        } else {
          radio.readOnly = false;
        }
      });
    }
  }

  disabledChanged() {
    const filteredRadios = this.getFilteredRadioButtons();

    if (filteredRadios !== undefined) {
      filteredRadios.forEach(radio => {
        if (this.disabled) {
          radio.disabled = true;
        } else {
          radio.disabled = false;
        }
      });
    }
  }

  nameChanged() {
    this.getFilteredRadioButtons().forEach(radio => {
      radio.setAttribute("name", this.name);
    });
  }
  /**
   * @internal
   */


  connectedCallback() {
    var _a;

    super.connectedCallback();
    const radioButtons = this.getFilteredRadioButtons();
    radioButtons.forEach(radio => {
      if (this.name !== undefined) {
        radio.setAttribute("name", this.name);
      }

      if (this.disabled) {
        radio.disabled = true;
      }

      if (this.readOnly) {
        radio.readOnly = true;
      }

      if (this.value && this.value === radio.getAttribute("value")) {
        this.selectedRadio = radio;
        this.focusedRadio = radio;
        radio.checked = true;
        radio.setAttribute("tabindex", "0");
      } else {
        radio.setAttribute("tabindex", "-1");
      }
    });

    if (this.value === undefined && radioButtons.length > 0) {
      radioButtons[0].setAttribute("tabindex", "0");
      this.focusedRadio = radioButtons[0];
    }

    this.parentToolbar = (_a = this.parentElement) === null || _a === void 0 ? void 0 : _a.closest('[role="toolbar"]');
    this.isInsideToolbar = this.parentToolbar !== undefined && this.parentToolbar !== null;
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], RadioGroup.prototype, "readOnly", void 0);

__decorate([attr({
  attribute: "disabled",
  mode: "boolean"
})], RadioGroup.prototype, "disabled", void 0);

__decorate([attr], RadioGroup.prototype, "name", void 0);

__decorate([attr], RadioGroup.prototype, "value", void 0);

__decorate([attr], RadioGroup.prototype, "orientation", void 0);

__decorate([observable], RadioGroup.prototype, "slottedRadioButtons", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Slider} component.
 * @public
 */

const SliderTemplate = html`<template role="slider" class="${x => x.readOnly ? "readonly" : ""} ${x => x.orientation || Orientation.horizontal}" tabindex="${x => x.disabled ? null : 0}" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" ?aria-disabled="${x => x.disabled}" ?aria-readonly="${x => x.readOnly}" aria-orientation="${x => x.orientation}" class="${x => x.orientation}"><div part="positioning-region" class="positioning-region"><div ${ref("track")}part="track-container" class="track"><slot name="track"></slot></div><div></div><slot></slot><div ${ref("thumb")}part="thumb-container" class="thumb-container" style=${x => x.position}><slot name="thumb"><div class="thumb-cursor"></div></slot></div></div></template>`;

/**
 * Converts a pixel coordinate on the track to a percent of the track's range
 */

function convertPixelToPercent(pixelPos, minPosition, maxPosition, direction) {
  let pct = limit(0, 1, (pixelPos - minPosition) / (maxPosition - minPosition));

  if (direction === Direction.rtl) {
    pct = 1 - pct;
  }

  return pct;
}

/**
 * The selection modes of a {@link Slider}
 * @public
 */

var SliderMode;

(function (SliderMode) {
  SliderMode["singleValue"] = "single-value";
})(SliderMode || (SliderMode = {}));
/**
 * An Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#slider | ARIA slider }.
 *
 * @public
 */


class Slider extends FormAssociated {
  constructor() {
    super(...arguments);
    /**
     * @internal
     */

    this.direction = Direction.ltr;
    /**
     * @internal
     */

    this.isDragging = false;
    /**
     * @internal
     */

    this.trackWidth = 0;
    /**
     * @internal
     */

    this.trackMinWidth = 0;
    /**
     * @internal
     */

    this.trackHeight = 0;
    /**
     * @internal
     */

    this.trackLeft = 0;
    /**
     * @internal
     */

    this.trackMinHeight = 0;
    /**
     * The minimum allowed value
     *
     * @defaultValue - 0
     * @public
     * HTML Attribute: min
     */

    this.min = 0; // Map to proxy element.

    /**
     * The maximum allowed value
     *
     * @defaultValue - 10
     * @public
     * HTML Attribute: max
     */

    this.max = 10; // Map to proxy element.

    /**
     * Value to increment or decrement via arrow keys, mouse click or drag
     *
     * @public
     * HTML Attribute: step
     */

    this.step = 1; // Map to proxy element.

    /**
     * Orientation of the slider
     *
     * @public
     * HTML Attribute: orientation
     */

    this.orientation = Orientation.horizontal;
    /**
     * The selection mode
     *
     * @public
     * HTML Attribute: mode
     */

    this.mode = SliderMode.singleValue;
    this.proxy = document.createElement("input");
    /**
     * Increment the value by the step
     *
     * @public
     */

    this.increment = () => {
      const newVal = this.direction !== Direction.rtl && this.orientation !== Orientation.vertical ? Number(this.value) + Number(this.step) : Number(this.value) - Number(this.step);
      const incrementedVal = this.convertToConstrainedValue(newVal);
      const incrementedValString = incrementedVal < Number(this.max) ? `${incrementedVal}` : `${this.max}`;
      this.value = incrementedValString;
      this.updateForm();
    };
    /**
     * Decrement the value by the step
     *
     * @public
     */


    this.decrement = () => {
      const newVal = this.direction !== Direction.rtl && this.orientation !== Orientation.vertical ? Number(this.value) - Number(this.step) : Number(this.value) + Number(this.step);
      const decrementedVal = this.convertToConstrainedValue(newVal);
      const decrementedValString = decrementedVal > Number(this.min) ? `${decrementedVal}` : `${this.min}`;
      this.value = decrementedValString;
      this.updateForm();
    };

    this.keypressHandler = e => {
      super.keypressHandler(e);

      if (e.keyCode !== keyCodeTab) {
        e.preventDefault();
      }

      if (e.keyCode === keyCodeHome) {
        this.value = `${this.min}`;
      } else if (e.keyCode === keyCodeEnd) {
        this.value = `${this.max}`;
      } else if (!e.shiftKey) {
        switch (e.keyCode) {
          case keyCodeArrowRight:
          case keyCodeArrowUp:
            this.increment();
            break;

          case keyCodeArrowLeft:
          case keyCodeArrowDown:
            this.decrement();
            break;
        }
      }
    };

    this.setThumbPositionForOrientation = direction => {
      const newPct = convertPixelToPercent(Number(this.value), Number(this.min), Number(this.max), direction);
      const percentage = Math.round((1 - newPct) * 100);

      if (this.orientation === Orientation.horizontal) {
        this.position = this.isDragging ? `right: ${percentage}%; transition: all 0.1s ease;` : `right: ${percentage}%; transition: all 0.2s ease;`;
      } else {
        this.position = this.isDragging ? `bottom: ${percentage}%; transition: all 0.1s ease;` : `bottom: ${percentage}%; transition: all 0.2s ease;`;
      }
    };

    this.getDirection = () => {
      const dirNode = this.parentElement.closest("[dir]");

      if (dirNode && dirNode.dir === "rtl") {
        this.setThumbPositionForOrientation(Direction.rtl);
      }

      return dirNode !== null && dirNode.dir === "rtl" ? Direction.rtl : Direction.ltr;
    };

    this.setupTrackConstraints = () => {
      const clientRect = this.track.getBoundingClientRect();
      this.trackWidth = this.track.clientWidth;
      this.trackMinWidth = this.track.clientLeft;
      this.trackHeight = clientRect.bottom;
      this.trackMinHeight = clientRect.top;
      this.trackLeft = this.getBoundingClientRect().left;

      if (this.trackWidth === 0) {
        this.trackWidth = 1;
      }
    };

    this.setupListeners = () => {
      this.addEventListener("keydown", this.keypressHandler);
      this.addEventListener("mousedown", this.handleMouseDown);
      this.thumb.addEventListener("mousedown", this.handleThumbMouseDown);
      this.thumb.addEventListener("touchstart", this.handleThumbMouseDown);
    };

    this.setupDefaultValue = () => {
      if (this.value === "") {
        this.value = `${this.convertToConstrainedValue((this.max + this.min) / 2)}`;
        this.updateForm();
      }
    };

    this.updateForm = () => {
      this.setFormValue(this.value, this.value);
    };
    /**
     *  Handle mouse moves during a thumb drag operation
     */


    this.handleThumbMouseDown = event => {
      if (this.readOnly || this.disabled || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      event.target.focus();
      window.addEventListener("mouseup", this.handleWindowMouseUp);
      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("touchmove", this.handleMouseMove);
      window.addEventListener("touchend", this.handleWindowMouseUp);
      this.isDragging = true;
    };
    /**
     *  Handle mouse moves during a thumb drag operation
     */


    this.handleMouseMove = e => {
      if (this.readOnly || this.disabled || e.defaultPrevented) {
        return;
      } // update the value based on current position


      const eventValue = this.orientation === Orientation.horizontal ? e.pageX - this.trackLeft : e.pageY;
      this.value = `${this.calculateNewValue(eventValue)}`;
      this.updateForm();
    };

    this.calculateNewValue = rawValue => {
      // update the value based on current position
      const newPosition = convertPixelToPercent(rawValue, this.orientation === Orientation.horizontal ? this.trackMinWidth : this.trackMinHeight, this.orientation === Orientation.horizontal ? this.trackWidth : this.trackHeight, this.direction);
      const newValue = (this.max - this.min) * newPosition + this.min;
      return this.convertToConstrainedValue(newValue);
    };
    /**
     * Handle a window mouse up during a drag operation
     */

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */


    this.handleWindowMouseUp = event => {
      this.stopDragging();
    };

    this.stopDragging = () => {
      this.isDragging = false;
      window.removeEventListener("mouseup", this.handleWindowMouseUp);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("touchmove", this.handleMouseMove);
      window.removeEventListener("touchend", this.handleWindowMouseUp);
    };

    this.handleMouseDown = e => {
      e.preventDefault();

      if (!this.disabled && !this.readOnly) {
        this.setupTrackConstraints();
        e.target.focus();
        window.addEventListener("mouseup", this.handleWindowMouseUp);
        window.addEventListener("mousemove", this.handleMouseMove);
        const controlValue = this.orientation === Orientation.horizontal ? e.pageX - this.trackLeft : e.pageY;
        this.value = `${this.calculateNewValue(controlValue)}`;
        this.updateForm();
      }
    };

    this.convertToConstrainedValue = value => {
      let constrainedValue = value - this.min;
      const remainderVal = constrainedValue % Number(this.step);
      constrainedValue = remainderVal >= Number(this.step) / 2 ? constrainedValue - remainderVal + Number(this.step) : constrainedValue - remainderVal;
      return constrainedValue + this.min;
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.updateForm();
    }

    if (this.$fastController.isConnected) {
      this.setThumbPositionForOrientation(this.direction);
    }

    this.$emit("change");
  }

  minChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.min = `${this.min}`;
    }
  }

  maxChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.max = `${this.max}`;
    }
  }

  stepChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.step = `${this.step}`;
    }
  }

  orientationChanged() {
    if (this.$fastController.isConnected) {
      this.setThumbPositionForOrientation(this.direction);
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "range");
    this.direction = this.getDirection();
    this.updateForm();
    this.setupTrackConstraints();
    this.setupListeners();
    this.setupDefaultValue();
    this.setThumbPositionForOrientation(this.direction);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    this.removeEventListener("keydown", this.keypressHandler);
    this.removeEventListener("mousedown", this.handleMouseDown);
    this.thumb.removeEventListener("mousedown", this.handleThumbMouseDown);
    this.thumb.removeEventListener("touchstart", this.handleThumbMouseDown);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Slider.prototype, "readOnly", void 0);

__decorate([observable], Slider.prototype, "direction", void 0);

__decorate([observable], Slider.prototype, "isDragging", void 0);

__decorate([observable], Slider.prototype, "position", void 0);

__decorate([observable], Slider.prototype, "trackWidth", void 0);

__decorate([observable], Slider.prototype, "trackMinWidth", void 0);

__decorate([observable], Slider.prototype, "trackHeight", void 0);

__decorate([observable], Slider.prototype, "trackLeft", void 0);

__decorate([observable], Slider.prototype, "trackMinHeight", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "min", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "max", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "step", void 0);

__decorate([attr], Slider.prototype, "orientation", void 0);

__decorate([attr], Slider.prototype, "mode", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#SliderLabel} component.
 * @public
 */

const SliderLabelTemplate = html`<template aria-disabled="${x => x.disabled}" class="${x => x.sliderOrientation || Orientation.horizontal} ${x => x.disabled ? "disabled" : ""}"><div ${ref("root")}part="root" class="root" style="${x => x.positionStyle}"><div class="container">${when(x => !x.hideMark, html`<div class="mark"></div>`)}<div class="label"><slot></slot></div></div></div></template>`;

const defaultConfig = {
  min: 0,
  max: 0,
  direction: Direction.ltr,
  orientation: Orientation.horizontal,
  disabled: false
};
/**
 * A label element intended to be used with the {@link @microsoft/fast-foundation#Slider} component.
 *
 * @public
 */

class SliderLabel extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * Hides the tick mark.
     *
     * @public
     * HTML Attribute: hide-mark
     */

    this.hideMark = false;
    /**
     * @internal
     */

    this.sliderDirection = Direction.ltr;

    this.getSliderConfiguration = () => {
      if (!this.isSliderConfig(this.parentNode)) {
        this.sliderDirection = defaultConfig.direction || Direction.ltr;
        this.sliderOrientation = defaultConfig.orientation || Orientation.horizontal;
        this.sliderMaxPosition = defaultConfig.max;
        this.sliderMinPosition = defaultConfig.min;
      } else {
        const parentSlider = this.parentNode;
        const {
          min,
          max,
          direction,
          orientation,
          disabled
        } = parentSlider;

        if (disabled !== undefined) {
          this.disabled = disabled;
        }

        this.sliderDirection = direction || Direction.ltr;
        this.sliderOrientation = orientation || Orientation.horizontal;
        this.sliderMaxPosition = max;
        this.sliderMinPosition = min;
      }
    };

    this.positionAsStyle = () => {
      const direction = this.sliderDirection ? this.sliderDirection : Direction.ltr;
      const pct = convertPixelToPercent(Number(this.position), Number(this.sliderMinPosition), Number(this.sliderMaxPosition));
      let rightNum = Math.round((1 - pct) * 100);
      let leftNum = Math.round(pct * 100);

      if (leftNum === Number.NaN && rightNum === Number.NaN) {
        rightNum = 50;
        leftNum = 50;
      }

      if (this.sliderOrientation === Orientation.horizontal) {
        return direction === Direction.rtl ? `right: ${leftNum}%; left: ${rightNum}%;` : `left: ${leftNum}%; right: ${rightNum}%;`;
      } else {
        return `top: ${leftNum}%; bottom: ${rightNum}%;`;
      }
    };
  }

  positionChanged() {
    this.positionStyle = this.positionAsStyle();
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.getSliderConfiguration();
    this.positionStyle = this.positionAsStyle();
    this.notifier = Observable.getNotifier(this.parentNode);
    this.notifier.subscribe(this, "orientation");
    this.notifier.subscribe(this, "direction");
    this.notifier.subscribe(this, "max");
    this.notifier.subscribe(this, "min");
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.notifier.unsubscribe(this, "orientation");
    this.notifier.unsubscribe(this, "direction");
    this.notifier.unsubscribe(this, "max");
    this.notifier.unsubscribe(this, "min");
  }
  /**
   * @internal
   */


  handleChange(source, propertyName) {
    switch (propertyName) {
      case "direction":
        this.sliderDirection = source.direction;
        break;

      case "orientation":
        this.sliderOrientation = source.orientation;
        break;

      case "max":
        this.sliderMinPosition = source.max;
        break;

      case "min":
        this.sliderMinPosition = source.min;
        break;
    }

    this.positionStyle = this.positionAsStyle();
  }

  isSliderConfig(node) {
    return node.max !== undefined && node.min !== undefined;
  }

}

__decorate([observable], SliderLabel.prototype, "positionStyle", void 0);

__decorate([attr], SliderLabel.prototype, "position", void 0);

__decorate([attr({
  attribute: "hide-mark",
  mode: "boolean"
})], SliderLabel.prototype, "hideMark", void 0);

__decorate([attr({
  attribute: "disabled",
  mode: "boolean"
})], SliderLabel.prototype, "disabled", void 0);

__decorate([observable], SliderLabel.prototype, "sliderOrientation", void 0);

__decorate([observable], SliderLabel.prototype, "sliderMinPosition", void 0);

__decorate([observable], SliderLabel.prototype, "sliderMaxPosition", void 0);

__decorate([observable], SliderLabel.prototype, "sliderDirection", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Switch} component.
 * @public
 */

const SwitchTemplate = html`<template role="switch" aria-checked="${x => x.checked}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" tabindex="${x => x.disabled ? null : 0}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}" class="${x => x.checked ? "checked" : ""}"><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><div part="switch" class="switch"><span class="checked-indicator" part="checked-indicator"></span></div><span class="status-message" part="status-message"><span class="checked-message" part="checked-message"><slot name="checked-message"></slot></span><span class="unchecked-message" part="unchecked-message"><slot name="unchecked-message"></slot></span></span></template>`;

/**
 * A Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#switch | ARIA switch }.
 *
 * @public
 */

class Switch extends FormAssociated {
  constructor() {
    super(...arguments);
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="checkbox"]
     *
     * @public
     * HTML Attribute: value
     */

    this.value = "on"; // Map to proxy element.

    /**
     * Initialized to the value of the checked attribute. Can be changed independently of the "checked" attribute,
     * but changing the "checked" attribute always additionally sets this value.
     *
     * @public
     */

    this.defaultChecked = !!this.checkedAttribute;
    /**
     * The checked state of the control.
     *
     * @public
     */

    this.checked = this.defaultChecked;
    this.proxy = document.createElement("input");
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input checkboxes
     */

    this.dirtyChecked = false;
    /**
     * @internal
     */

    this.keypressHandler = e => {
      super.keypressHandler(e);

      switch (e.keyCode) {
        case keyCodeSpace:
          this.checked = !this.checked;
          break;
      }
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly) {
        this.checked = !this.checked;
      }
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }

    this.readOnly ? this.classList.add("readonly") : this.classList.remove("readonly");
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    if (!this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      this.checked = this.defaultChecked;
      this.dirtyChecked = false;
    }
  }

  checkedChanged() {
    if (!this.dirtyChecked) {
      this.dirtyChecked = true;
    }

    this.updateForm();

    if (this.proxy instanceof HTMLElement) {
      this.proxy.checked = this.checked;
    }

    this.$emit("change");
    this.checked ? this.classList.add("checked") : this.classList.remove("checked");
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "checkbox");
    this.updateForm();
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Switch.prototype, "readOnly", void 0);

__decorate([attr], Switch.prototype, "value", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Switch.prototype, "checkedAttribute", void 0);

__decorate([observable], Switch.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Switch.prototype, "defaultChecked", void 0);

__decorate([observable], Switch.prototype, "checked", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Tabs:class)} component.
 * @public
 */

const TabsTemplate = html`<template class="${x => x.orientation}">${startTemplate}<div class="tablist" part="tablist" role="tablist"><slot class="tab" name="tab" part="tab" ${slotted("tabs")}></slot>${when(x => x.activeindicator, html`<div ${ref("activeIndicatorRef")}class="activeIndicator" part="activeIndicator"></div>`)}</div>${endTemplate}<div class="tabpanel"><slot name="tabpanel" part="tabpanel" ${slotted("tabpanels")}></slot></div></template>`;

/**
 * The orientation of the {@link @microsoft/fast-foundation#(Tabs:class)} component
 * @public
 */

var TabsOrientation;

(function (TabsOrientation) {
  TabsOrientation["vertical"] = "vertical";
  TabsOrientation["horizontal"] = "horizontal";
})(TabsOrientation || (TabsOrientation = {}));
/**
 * An Tabs Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#tablist | ARIA tablist }.
 *
 * @public
 */


class Tabs extends FASTElement {
  constructor() {
    super();
    /**
     * The orientation
     * @public
     * @remarks
     * HTML Attribute: orientation
     */

    this.orientation = TabsOrientation.horizontal;
    /**
     * Whether or not to show the active indicator
     * @public
     * @remarks
     * HTML Attribute: activeindicator
     */

    this.activeindicator = true;
    this.prevActiveTabIndex = 0;
    this.activeTabIndex = 0;
    this.ticking = false;

    this.change = () => {
      this.$emit("change", this.activetab);
    };

    this.setTabs = () => {
      this.tabIds = this.getTabIds();
      this.tabpanelIds = this.getTabPanelIds();
      this.activeTabIndex = this.getActiveIndex();
      this.tabs.forEach((tab, index) => {
        if (tab.slot === "tab") {
          const tabId = this.tabIds[index];
          const tabpanelId = this.tabpanelIds[index];
          tab.setAttribute("id", typeof tabId !== "string" ? `tab-${index + 1}` : tabId);
          tab.setAttribute("aria-selected", this.activeTabIndex === index ? "true" : "false");
          tab.setAttribute("aria-controls", typeof tabpanelId !== "string" ? `panel-${index + 1}` : tabpanelId);
          tab.setAttribute("style", this.isHorizontal() ? `grid-column: ${index + 1};` : `grid-row: ${index + 1};`);
          tab.addEventListener("click", this.handleTabClick);
          tab.addEventListener("keydown", this.handleTabKeyDown);
          tab.setAttribute("tabindex", this.activeTabIndex === index ? "0" : "-1");

          if (this.activeTabIndex === index) {
            this.activetab = tab;
          }

          !this.isHorizontal() ? tab.classList.add("vertical") : tab.classList.remove("vertical");
        }
      });
    };

    this.setTabPanels = () => {
      this.tabIds = this.getTabIds();
      this.tabpanelIds = this.getTabPanelIds();
      this.tabpanels.forEach((tabpanel, index) => {
        const tabId = this.tabIds[index];
        const tabpanelId = this.tabpanelIds[index];
        tabpanel.setAttribute("id", typeof tabpanelId !== "string" ? `panel-${index + 1}` : tabpanelId);
        tabpanel.setAttribute("aria-labelledby", typeof tabId !== "string" ? `tab-${index + 1}` : tabId);
        this.activeTabIndex !== index ? tabpanel.setAttribute("hidden", "") : tabpanel.removeAttribute("hidden");
      });
    };

    this.handleTabClick = event => {
      const selectedTab = event.currentTarget;
      this.prevActiveTabIndex = this.activeTabIndex;
      this.activeTabIndex = Array.from(this.tabs).indexOf(selectedTab);

      if (selectedTab.nodeType === 1) {
        this.setComponent();
      }
    };

    this.handleTabKeyDown = event => {
      const keyCode = event.keyCode;

      if (this.isHorizontal()) {
        switch (keyCode) {
          case keyCodeArrowLeft:
            event.preventDefault();
            this.adjust(-1);
            break;

          case keyCodeArrowRight:
            event.preventDefault();
            this.adjust(1);
            break;
        }
      } else {
        switch (keyCode) {
          case keyCodeArrowUp:
            event.preventDefault();
            this.adjust(-1);
            break;

          case keyCodeArrowDown:
            event.preventDefault();
            this.adjust(1);
            break;
        }
      }

      switch (keyCode) {
        case keyCodeHome:
          event.preventDefault();
          this.activeTabIndex = 0;
          this.setComponent();
          break;

        case keyCodeEnd:
          event.preventDefault();
          this.activeTabIndex = this.tabs.length - 1;
          this.setComponent();
          break;
      }
    };

    if (this.$fastController.isConnected) {
      this.tabIds = this.getTabIds();
      this.tabpanelIds = this.getTabPanelIds();
      this.activeTabIndex = this.getActiveIndex();
    }
  }
  /**
   * @internal
   */


  tabsChanged() {
    if (this.$fastController.isConnected && this.tabs.length <= this.tabpanels.length) {
      this.setTabs();
      this.setTabPanels();
      this.handleActiveIndicatorPosition();
    }
  }
  /**
   * @internal
   */


  tabpanelsChanged() {
    if (this.$fastController.isConnected && this.tabpanels.length <= this.tabs.length) {
      this.setTabs();
      this.setTabPanels();
      this.handleActiveIndicatorPosition();
    }
  }

  getActiveIndex() {
    const id = this.activeid;

    if (id !== undefined) {
      return this.tabIds.indexOf(this.activeid) === -1 ? 0 : this.tabIds.indexOf(this.activeid);
    } else {
      return 0;
    }
  }

  getTabIds() {
    return this.tabs.map(tab => {
      return tab.getAttribute("id");
    });
  }

  getTabPanelIds() {
    return this.tabpanels.map(tabPanel => {
      return tabPanel.getAttribute("id");
    });
  }

  setComponent() {
    this.activeid = this.tabIds[this.activeTabIndex];
    this.change();
    this.setTabs();
    this.handleActiveIndicatorPosition();
    this.setTabPanels();
    this.focusTab();
    this.change();
  }

  isHorizontal() {
    return this.orientation === TabsOrientation.horizontal;
  }

  handleActiveIndicatorPosition() {
    if (this.activeindicator) {
      if (this.ticking) {
        this.activeIndicatorRef.style.transform = "translateX(0px)";
        this.activeIndicatorRef.classList.remove("activeIndicatorTransition");

        if (this.isHorizontal()) {
          this.activeIndicatorRef.style.gridColumn = `${this.activeTabIndex + 1}`;
        } else {
          this.activeIndicatorRef.style.gridRow = `${this.activeTabIndex + 1}`;
        }

        this.ticking = false;
      } else {
        this.ticking = true;
        this.animateActiveIndicator();
      }
    }
  }

  animateActiveIndicator() {
    const gridProperty = this.isHorizontal() ? "gridColumn" : "gridRow";
    const translateProperty = this.isHorizontal() ? "translateX" : "translateY";
    const offsetProperty = this.isHorizontal() ? "offsetLeft" : "offsetTop";
    const prev = this.activeIndicatorRef[offsetProperty];
    this.activeIndicatorRef.style[gridProperty] = `${this.activeTabIndex + 1}`;
    const next = this.activeIndicatorRef[offsetProperty];
    this.activeIndicatorRef.style[gridProperty] = `${this.prevActiveTabIndex + 1}`;
    const dif = next - prev;
    this.activeIndicatorRef.style.transform = `${translateProperty}(${dif}px)`;
    this.activeIndicatorRef.classList.add("activeIndicatorTransition");
    this.activeIndicatorRef.addEventListener("transitionend", () => {
      this.ticking = false;
      this.activeIndicatorRef.style[gridProperty] = `${this.activeTabIndex + 1}`;
      this.activeIndicatorRef.style.transform = `${translateProperty}(0px)`;
      this.activeIndicatorRef.classList.remove("activeIndicatorTransition");
    });
  }
  /**
   * The adjust method for FASTTabs
   * @public
   * @remarks
   * This method allows the active index to be adjusted by numerical increments
   */


  adjust(adjustment) {
    this.prevActiveTabIndex = this.activeTabIndex;
    this.activeTabIndex = wrapInBounds(0, this.tabs.length - 1, this.activeTabIndex + adjustment);
    this.setComponent();
  }

  focusTab() {
    this.tabs[this.activeTabIndex].focus();
  }

}

__decorate([attr], Tabs.prototype, "orientation", void 0);

__decorate([attr], Tabs.prototype, "activeid", void 0);

__decorate([observable], Tabs.prototype, "tabs", void 0);

__decorate([observable], Tabs.prototype, "tabpanels", void 0);

__decorate([attr({
  mode: "boolean"
})], Tabs.prototype, "activeindicator", void 0);

__decorate([observable], Tabs.prototype, "activeIndicatorRef", void 0);

applyMixins(Tabs, StartEnd);

/**
 * The template for the {@link @microsoft/fast-foundation#Tab} component.
 * @public
 */

const TabTemplate = html`<template slot="tab" role="tab"><slot></slot></template>`;

/**
 * A Tab Component to be used with {@link @microsoft/fast-foundation#(Tabs:class)}
 * @public
 */

class Tab extends FASTElement {}

/**
 * The template for the {@link @microsoft/fast-foundation#TabPanel} component.
 * @public
 */

const TabPanelTemplate = html`<template slot="tabpanel" role="tabpanel"><slot></slot></template>`;

/**
 * A TabPanel Component to be used with {@link @microsoft/fast-foundation#(Tabs:class)}
 * @public
 */

class TabPanel extends FASTElement {}

/**
 * The template for the {@link @microsoft/fast-foundation#(TextField:class)} component.
 * @public
 */

const TextFieldTemplate = html`<template tabindex="${x => x.disabled ? null : 0}" class=" ${x => x.readOnly ? "readonly" : ""}"><label part="label" for="control" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><div class="root" part="root">${startTemplate}<input class="control" part="control" id="control" @input="${x => x.handleTextInput()}" placeholder="${x => x.placeholder}" ?required="${x => x.required}" ?disabled="${x => x.disabled}" ?readonly="${x => x.readOnly}" value="${x => x.value}" type="${x => x.type}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaDisabled}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}/>${endTemplate}</div></template>`;

/**
 * Text field sub-types
 * @public
 */

var TextFieldType;

(function (TextFieldType) {
  /**
   * An email TextField
   */
  TextFieldType["email"] = "email";
  /**
   * A password TextField
   */

  TextFieldType["password"] = "password";
  /**
   * A telephone TextField
   */

  TextFieldType["tel"] = "tel";
  /**
   * A text TextField
   */

  TextFieldType["text"] = "text";
  /**
   * A URL TextField
   */

  TextFieldType["url"] = "url";
})(TextFieldType || (TextFieldType = {}));
/**
 * An Text Field Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/text | <input type="text" /> element }.
 *
 * @public
 */


class TextField extends FormAssociated {
  constructor() {
    super(...arguments);
    /**
     * Allows setting a type or mode of text.
     * @public
     * @remarks
     * HTML Attribute: type
     */

    this.type = TextFieldType.text;
    this.proxy = document.createElement("input");
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  autofocusChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.autofocus = this.autofocus;
    }
  }

  placeholderChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.placeholder = this.placeholder;
    }
  }

  typeChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.type = this.type;
    }
  }

  listChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.setAttribute("list", this.list);
    }
  }

  maxlengthChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.maxLength = this.maxlength;
    }
  }

  minlengthChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.minLength = this.minlength;
    }
  }

  patternChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.pattern = this.pattern;
    }
  }

  sizeChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.size = this.size;
    }
  }

  spellcheckChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.spellcheck = this.spellcheck;
    }
  }

  valueChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }

    this.$emit("change", this.value);
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", this.type);

    if (this.autofocus) {
      this.focus();
    }

    this.setFormValue(this.value, this.value);
  }
  /**
   * @internal
   */


  handleTextInput() {
    if (this.control && this.control.value) {
      this.value = this.control.value;
    }
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], TextField.prototype, "readOnly", void 0);

__decorate([attr({
  mode: "boolean"
})], TextField.prototype, "autofocus", void 0);

__decorate([attr], TextField.prototype, "placeholder", void 0);

__decorate([attr], TextField.prototype, "type", void 0);

__decorate([attr], TextField.prototype, "list", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "maxlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "minlength", void 0);

__decorate([attr], TextField.prototype, "pattern", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "size", void 0);

__decorate([attr({
  mode: "boolean"
})], TextField.prototype, "spellcheck", void 0);

__decorate([observable], TextField.prototype, "defaultSlottedNodes", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA link role
 *
 * @public
 */

/* eslint-disable-next-line */


class DelegatesARIATextbox extends ARIAGlobalStatesAndProperties {}
applyMixins(TextField, StartEnd, DelegatesARIATextbox);

/**
 * Resize mode for a TextArea
 * @public
 */

var TextAreaResize;

(function (TextAreaResize) {
  /**
   * No resize.
   */
  TextAreaResize["none"] = "none";
  /**
   * Resize vertically and horizontally.
   */

  TextAreaResize["both"] = "both";
  /**
   * Resize horizontally.
   */

  TextAreaResize["horizontal"] = "horizontal";
  /**
   * Resize vertically.
   */

  TextAreaResize["vertical"] = "vertical";
})(TextAreaResize || (TextAreaResize = {}));
/**
 * An Text Area Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea | <textarea> element }.
 *
 * @public
 */


class TextArea extends FormAssociated {
  constructor() {
    super(...arguments);
    /**
     * The resize mode of the element.
     * @public
     * @remarks
     * HTML Attribute: resize
     */

    this.resize = TextAreaResize.none;
    /**
     * Sizes the element horizontally by a number of character columns.
     *
     * @public
     * @remarks
     * HTML Attribute: cols
     */

    this.cols = 20;
    this.proxy = document.createElement("textarea");
    /**
     * @internal
     */

    this.handleTextInput = () => {
      this.$emit("change", this.textarea.value);
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  autofocusChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.autofocus = this.autofocus;
    }
  }

  listChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.setAttribute("list", this.list);
    }
  }

  maxlengthChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.maxLength = this.maxlength;
    }
  }

  minlengthChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.minLength = this.minlength;
    }
  }

  spellcheckChanged() {
    if (this.proxy instanceof HTMLElement) {
      this.proxy.spellcheck = this.spellcheck;
    }
  }
  /**
   * @internal
   */


  valueChanged() {
    if (this.textarea && this.value !== this.textarea.value) {
      this.textarea.value = this.value;
    }

    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();

    if (this.value) {
      this.textarea.value = this.value;
      this.setFormValue(this.value, this.value);
    }
  }

}

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "readOnly", void 0);

__decorate([attr], TextArea.prototype, "resize", void 0);

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "autofocus", void 0);

__decorate([attr({
  attribute: "form"
})], TextArea.prototype, "formId", void 0);

__decorate([attr], TextArea.prototype, "list", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextArea.prototype, "maxlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextArea.prototype, "minlength", void 0);

__decorate([attr], TextArea.prototype, "name", void 0);

__decorate([attr], TextArea.prototype, "placeholder", void 0);

__decorate([attr({
  converter: nullableNumberConverter,
  mode: "fromView"
})], TextArea.prototype, "cols", void 0);

__decorate([attr({
  converter: nullableNumberConverter,
  mode: "fromView"
})], TextArea.prototype, "rows", void 0);

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "spellcheck", void 0);

__decorate([observable], TextArea.prototype, "defaultSlottedNodes", void 0);

applyMixins(TextArea, DelegatesARIATextbox);

/**
 * The template for the {@link @microsoft/fast-foundation#(TextArea:class)} component.
 * @public
 */

const TextAreaTemplate = html`<template class=" ${x => x.readOnly ? "readonly" : ""} ${x => x.resize !== TextAreaResize.none ? `resize-${x.resize}` : ""}"><label part="label" for="control" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><textarea part="control" class="control" id="control" ?autofocus="${x => x.autofocus}" cols="${x => x.cols}" ?disabled="${x => x.disabled}" form="${x => x.form}" list="${x => x.list}" maxlength="${x => x.maxlength}" minlength="${x => x.minlength}" name="${x => x.name}" placeholder="${x => x.placeholder}" ?readonly="${x => x.readOnly}" ?required="${x => x.required}" rows="${x => x.rows}" ?spellcheck="${x => x.spellcheck}" value="${x => x.value}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" @input="${x => x.handleTextInput()}" ${ref("textarea")}></textarea></template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(TreeItem:class)} component.
 * @public
 */

const TreeItemTemplate = html`<template role="treeitem" slot="${x => x.isNestedItem() ? "item" : void 0}" tabindex="${x => x.disabled ? void 0 : x.focusable ? 0 : -1}" class="${x => x.expanded ? "expanded" : ""} ${x => x.selected ? "selected" : ""} ${x => x.nested ? "nested" : ""} ${x => x.disabled ? "disabled" : ""}" aria-expanded="${x => x.expanded ? x.expanded : void 0}" aria-selected="${x => x.selected}" aria-disabled="${x => x.disabled}" @focus="${(x, c) => x.handleFocus(c.event)}" @blur="${(x, c) => x.handleBlur(c.event)}" @keydown="${(x, c) => x.handleKeyDown(c.event)}" ${children({
  property: "childItems",
  filter: elements()
})}><div class="positioning-region" part="positioning-region" @click="${(x, c) => x.handleContainerClick(c.event)}"><div class="content-region" part="content-region">${when(x => x.childItems && x.childItemLength() > 0, html`<div aria-hidden="true" class="expand-collapse-button" part="expand-collapse-button" @click="${x => x.handleExpandCollapseButtonClick()}" ${ref("expandCollapseButton")}><slot name="expand-collapse-glyph"><svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" class="expand-collapse-glyph"><path d="M4.29 12L12 4.29V12H4.29z" /></svg></slot></div>`)} ${startTemplate}<slot></slot>${endTemplate}</div></div>${when(x => x.childItems && x.childItemLength() > 0 && (x.expanded || x.renderCollapsedChildren), html`<div role="group" class="items" part="items"><slot name="item" ${slotted("items")}></slot></div>`)}</template>`;

/**
 * check if the item is a tree item
 * @public
 * @remarks
 * determines if element is an HTMLElement and if it has the role treeitem
 */

function isTreeItemElement(el) {
  return isHTMLElement(el) && el.getAttribute("role") === "treeitem";
}
/**
 * A Tree item Custom HTML Element.
 *
 * @public
 */

class TreeItem extends FASTElement {
  constructor() {
    super(...arguments);
    /**
     * When true, the control will be appear expanded by user interaction.
     * @public
     * @remarks
     * HTML Attribute: expanded
     */

    this.expanded = false;
    this.focusable = false;

    this.handleFocus = e => {
      if (e.target === e.currentTarget) {
        this.focusable = true;
      }
    };

    this.handleBlur = e => {
      if (e.target !== e.currentTarget) {
        return;
      }

      this.focusable = false;
    };

    this.handleKeyDown = e => {
      if (e.target !== e.currentTarget) {
        return;
      }

      switch (e.keyCode) {
        case keyCodeArrowLeft:
          this.handleArrowLeft();
          break;

        case keyCodeArrowRight:
          this.handleArrowRight();
          break;

        case keyCodeArrowDown:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.focusNextNode(1);
          break;

        case keyCodeArrowUp:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.focusNextNode(-1);
          break;

        case keyCodeEnter:
          this.handleSelected(e);
          break;

        case keyCodeSpace:
          this.handleSpaceBar();
          break;
      }

      return true;
    };

    this.handleExpandCollapseButtonClick = () => {
      if (!this.disabled) {
        this.setExpanded(!this.expanded);
      }
    };

    this.handleContainerClick = e => {
      const expandButton = this.expandCollapseButton;
      const isButtonAnHTMLElement = isHTMLElement(expandButton);

      if ((!isButtonAnHTMLElement || isButtonAnHTMLElement && expandButton !== e.target) && !this.disabled) {
        this.handleSelected(e);
      }
    };

    this.isNestedItem = () => {
      return isTreeItemElement(this.parentElement);
    };
  }

  itemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.items.forEach(node => {
        if (isTreeItemElement(node)) {
          // TODO: maybe not require it to be a TreeItem?
          node.nested = true;
        }
      });
    }
  }

  getParentTreeNode() {
    const parentNode = this.parentElement.closest("[role='tree']");
    return parentNode;
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    const parentTreeNode = this.getParentTreeNode();

    if (parentTreeNode) {
      if (parentTreeNode.hasAttribute("render-collapsed-nodes")) {
        this.renderCollapsedChildren = parentTreeNode.getAttribute("render-collapsed-nodes") === "true";
      }

      this.notifier = Observable.getNotifier(parentTreeNode);
      this.notifier.subscribe(this, "renderCollapsedNodes");
    }
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.notifier) {
      this.notifier.unsubscribe(this, "renderCollapsedNodes");
    }
  }

  handleChange(source, propertyName) {
    switch (propertyName) {
      case "renderCollapsedNodes":
        this.renderCollapsedChildren = source.renderCollapsedNodes;
        break;
    }
  }

  childItemLength() {
    const treeChildren = this.childItems.filter(item => {
      return isTreeItemElement(item);
    });
    return treeChildren ? treeChildren.length : 0;
  }

  handleArrowLeft() {
    if (this.expanded) {
      this.setExpanded(false);
    } else if (isHTMLElement(this.parentElement)) {
      const parentTreeItemNode = this.parentElement.closest("[role='treeitem']");

      if (isHTMLElement(parentTreeItemNode)) {
        parentTreeItemNode.focus();
      }
    }
  }

  handleArrowRight() {
    if (typeof this.expanded !== "boolean") {
      return;
    }

    if (!this.expanded) {
      this.setExpanded(true);
    } else {
      this.focusNextNode(1);
    }
  }

  handleSpaceBar() {
    if (typeof this.expanded !== "boolean") {
      return;
    }

    this.setExpanded(!this.expanded);
  }

  focusNextNode(delta) {
    const visibleNodes = this.getVisibleNodes();

    if (!visibleNodes) {
      return;
    }

    const currentIndex = visibleNodes.indexOf(this);

    if (currentIndex !== -1) {
      let nextElement = visibleNodes[currentIndex + delta];

      if (nextElement !== undefined) {
        while (nextElement.hasAttribute("disabled")) {
          const offset = delta >= 0 ? 1 : -1;
          nextElement = visibleNodes[currentIndex + delta + offset];

          if (!nextElement) {
            break;
          }
        }
      }

      if (isHTMLElement(nextElement)) {
        nextElement.focus();
      }
    }
  }

  getVisibleNodes() {
    return getDisplayedNodes(this.getTreeRoot(), "[role='treeitem']");
  }

  getTreeRoot() {
    /* eslint-disable-next-line  @typescript-eslint/no-this-alias */
    const currentNode = this;

    if (!isHTMLElement(currentNode)) {
      return null;
    }

    return currentNode.closest("[role='tree']");
  }

  handleSelected(e) {
    this.selected = !this.selected;
    this.$emit("selected-change", e);
  }

  setExpanded(expanded) {
    this.expanded = expanded;
    this.$emit("expanded-change", this);
  }

}

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "expanded", void 0);

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "selected", void 0);

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "disabled", void 0);

__decorate([observable], TreeItem.prototype, "focusable", void 0);

__decorate([observable], TreeItem.prototype, "childItems", void 0);

__decorate([observable], TreeItem.prototype, "items", void 0);

__decorate([observable], TreeItem.prototype, "nested", void 0);

__decorate([observable], TreeItem.prototype, "renderCollapsedChildren", void 0);

applyMixins(TreeItem, StartEnd);

/**
 * The template for the {@link @microsoft/fast-foundation#TreeView} component.
 * @public
 */

const TreeViewTemplate = html`<template role="tree" tabindex="${x => x.focusable ? 0 : -1}" ${ref("treeView")}@keydown="${(x, c) => x.handleKeyDown(c.event)}" @focus="${(x, c) => x.handleFocus(c.event)}" @blur="${(x, c) => x.handleBlur(c.event)}"><slot ${slotted("slottedTreeItems")}></slot></template>`;

/**
 * A Tree view Custom HTML Element.
 * Implements the {@link https://w3c.github.io/aria-practices/#TreeView | ARIA TreeView }.
 *
 * @public
 */

class TreeView extends FASTElement {
  constructor() {
    super(...arguments);
    this.focusable = true;

    this.handleBlur = e => {
      const root = this.treeView;
      /**
       * If we focus outside of the tree
       */

      if (isHTMLElement(root) && !root.contains(e.relatedTarget)) {
        this.focusable = true;
      }

      this.ensureFocusability();
    };

    this.handleFocus = e => {
      if (!isHTMLElement(this.treeView)) {
        return;
      }

      const root = this.treeView;
      const lastFocused = this.lastFocused;
      /**
       * If the tree view is receiving focus
       */

      if (isHTMLElement(root) && root === e.target) {
        // If we have a last focused item, focus it - otherwise check for an initially selected item or focus the first "[role='treeitem']"
        // If there is no "[role='treeitem']" to be focused AND no last-focused, then there are likely no children
        // or children are malformed so keep the tree in the tab-order in the hopes that the author cleans up
        // the children
        const selectedChild = root.querySelector("[aria-selected='true']");
        const toBeFocused = !!lastFocused ? lastFocused : !!selectedChild ? selectedChild : root.querySelector("[role='treeitem']");

        if (toBeFocused && isHTMLElement(toBeFocused)) {
          toBeFocused.focus();

          if (this.focusable) {
            this.focusable = false;
          }
        }
      } else {
        // A child is receiving focus. While focus is within the tree, we simply need to ensure
        // that the tree is not focusable.
        if (this.focusable) {
          this.focusable = false;
        }
      }
    };

    this.handleKeyDown = e => {
      if (!this.treeItems) {
        return true;
      }

      switch (e.keyCode) {
        case keyCodeHome:
          if (this.treeItems && this.treeItems.length) {
            this.treeItems[0].focus();
          }

          break;

        case keyCodeEnd:
          if (this.treeItems && this.treeItems.length) {
            this.treeItems[this.treeItems.length - 1].focus();
          }

          break;

        default:
          return true;
      }
    };

    this.setItems = () => {
      const focusIndex = this.treeItems.findIndex(this.isFocusableElement);

      for (let item = 0; item < this.treeItems.length; item++) {
        if (item === focusIndex && !this.treeItems[item].hasAttribute("disabled")) {
          this.treeItems[item].setAttribute("tabindex", "0");
        }

        this.treeItems[item].addEventListener("selected-change", this.handleItemSelected);
      }
    };

    this.resetItems = () => {
      for (let item = 0; item < this.treeItems.length; item++) {
        this.treeItems[item].removeEventListener("selected-change", this.handleItemSelected);
      }
    };

    this.handleItemSelected = e => {
      const newSelection = e.target;

      if (newSelection !== this.currentSelected) {
        if (this.currentSelected) {
          // TODO: fix this below, shouldn't need both
          this.currentSelected.removeAttribute("selected");
          this.currentSelected.selected = false;
        }

        this.currentSelected = newSelection;
      }
    };
    /**
     * check if the item is focusable
     */


    this.isFocusableElement = el => {
      return isTreeItemElement(el) && !this.isDisabledElement(el);
    };
    /**
     * check if the item is disabled
     */


    this.isDisabledElement = el => {
      return isTreeItemElement(el) && el.getAttribute("aria-disabled") === "true";
    };
  }

  slottedTreeItemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      // filter the tree items until that's done for us in the framework
      this.resetItems();
      this.treeItems = this.getVisibleNodes();
      this.setItems(); // check if any tree items have nested items
      // if they do, apply the nested attribute

      if (this.checkForNestedItems()) {
        this.slottedTreeItems.forEach(node => {
          if (isTreeItemElement(node)) {
            node.nested = true;
          }
        });
      }
    }
  }

  checkForNestedItems() {
    return this.slottedTreeItems.some(node => {
      return isTreeItemElement(node) && node.querySelector("[role='treeitem']");
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.treeItems = this.getVisibleNodes();
    DOM.queueUpdate(() => {
      //only supporting single select
      const node = this.treeView.querySelector("[aria-selected='true']");

      if (node) {
        this.currentSelected = node;
      }
    });
    this.ensureFocusability();
  }

  getVisibleNodes() {
    const treeItems = [];

    if (this.slottedTreeItems !== undefined) {
      this.slottedTreeItems.forEach(item => {
        if (isTreeItemElement(item)) {
          treeItems.push(item);
        }
      });
    }

    return treeItems;
  }
  /**
   * Verifies that the tree has a focusable child.
   * If it does not, the tree will begin to accept focus
   */


  ensureFocusability() {
    if (!this.focusable && isHTMLElement(this.treeView)) {
      const focusableChild = this.querySelector("[role='treeitem'][tabindex='0']");

      if (!isHTMLElement(focusableChild)) {
        this.focusable = true;
      }
    }
  }

}

__decorate([attr({
  attribute: "render-collapsed-nodes"
})], TreeView.prototype, "renderCollapsedNodes", void 0);

__decorate([observable], TreeView.prototype, "focusable", void 0);

__decorate([observable], TreeView.prototype, "currentSelected", void 0);

__decorate([observable], TreeView.prototype, "lastFocused", void 0);

__decorate([observable], TreeView.prototype, "nested", void 0);

__decorate([observable], TreeView.prototype, "slottedTreeItems", void 0);

const LabelStyles = css` ${display("inline-block")} :host{font-family: var(--body-font);font-weight: var(--font-weight-semiBold);outline: none;user-select: none}:host(.disabled) label{opacity: var(--disabled-opacity)}:host(.required) label::after{content: ' *';color: #a4262c;padding-right: 12px}`;

let FluentLabel = class FluentLabel extends FASTElement {
  requiredChanged() {
    console.log("required");
    DOM.queueUpdate(() => this.classList.toggle("required", this.required));
  }

  disabledChanged() {
    console.log("disabled");
    DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
  }

};

__decorate([attr({
  mode: "boolean"
})], FluentLabel.prototype, "required", void 0);

__decorate([attr({
  mode: "boolean"
})], FluentLabel.prototype, "disabled", void 0);

__decorate([attr], FluentLabel.prototype, "for", void 0);

FluentLabel = __decorate([customElement({
  name: "fast-fluent-label",
  template: LabelTemplate,
  styles: LabelStyles,
  shadowOptions: {
    delegatesFocus: true
  }
})], FluentLabel);

var generateTemplateString = function () {
  var cache = {};

  function generateTemplate(template) {
    var fn = cache[template];

    if (!fn) {
      // Replace ${expressions} (etc) with ${map.expressions}.
      var sanitized = template.replace(/\$\{([\s]*[^;\s\{]+[\s]*)\}/g, function (_, match) {
        return `\$\{map.${match.trim()}\}`;
      }) // Afterwards, replace anything that's not ${map.expressions}' (etc) with a blank string.
      .replace(/(\$\{(?!map\.)[^}]+\})/g, '');
      fn = Function('map', `return \`${sanitized}\``);
    }

    return fn;
  }

  return generateTemplate;
}();

const ListTemplate = html`<template><div ${ref('_root')}role="list" style="overflow-y:hidden;height:100%;width:100%;"><div ${ref('scrollElement')} ${children('_refs')}style="overflow-y:auto;height:100%;width:100%;"><div ${ref('spacerBefore')}class="spacer" data-List-spacer="before" style="height:${x => x.virtualizedData.numItemsToSkipBefore * x.averageHeight}px;"></div>${repeat(x => x.virtualizedData.subSetOfItems, html`<div role='listitem' class='ms-List-cell' style="height:50px;" data-list-key="${(x, c) => {
  let fluentList = c.parent;
  let itemKey = fluentList.getKey ? fluentList.getKey(x.item, x.index) : x && x.key;

  if (itemKey === null || itemKey === undefined) {
    itemKey = x.index;
  }

  return itemKey;
}}" data-list-index="${(x, c) => x.index}">${(x, c) => {
  try {
    let fluentList = c.parent;
    let template;

    for (let i = 0; i < fluentList.children.length; i++) {
      template = fluentList.children.item(i);

      if (template !== undefined) {
        break;
      }
    } //fluentList.children.item(0) as HTMLTemplateElement; 


    if (template !== undefined) {
      //let template = fluentList.slottedNodes.find(x=>x.nodeName.toLowerCase() === "template") as HTMLTemplateElement; //.filter(v => v.nodeType === 1)[0] as HTMLTemplateElement;
      try {
        console.log(x);
        var replaced = generateTemplateString(template.innerHTML)(x);
        console.log(replaced); //if (template !== undefined){

        return html`${replaced}`;
      } catch (ex) {
        console.log(ex);
        html`${JSON.stringify(ex)}`;
      } //}
      //return "template undefined";

    }

    return "template undefined";
  } catch (ex) {
    return "BIG ERROR";
  }
}}<!--                     
                    <fast-fluent-list-item index="${x => x.index}">${x => x.item.value}<slot name="itemTemplate"></slot></fast-fluent-list-item> --></div>`, {
  positioning: false
})}<div ${ref('spacerAfter')}class="spacer" data-List-spacer="after" style="height:${x => x.virtualizedData.numItemsToSkipAfter * x.averageHeight}px;"></div></div></div><slot ${slotted('slottedNodes')}></slot></template>`;

const ListStyles = css` ${display("inline-block")} :host{font-family: var(--body-font);font-weight: var(--font-weight-semiBold);outline: none;user-select: none;height:100%;overflow-y:hidden;width:100%}:host(.disabled) label{opacity: var(--disabled-opacity)}:host(.required) label::after{content: ' *';color: #a4262c;padding-right: 12px}`;

let FluentList = class FluentList extends FASTElement {
  constructor() {
    super();
    this.renderedWindowsAhead = 2;
    this.renderedWindowsBehind = 2;
    this.startIndex = 0; // The visible rect that we're required to render given the current list state.
    // private _requiredRect: IRectangle | null;
    // // surface rect relative to window
    // private _surfaceRect: IRectangle | undefined;
    // // The visible rect that we're allowed to keep rendered. Pages outside of this rect will be removed.
    // private _allowedRect: IRectangle;
    // // The rect that is visible to the user
    // private _visibleRect: IRectangle | undefined;
    // materialized rect around visible items, relative to surface
    // private _materializedRect: IRectangle | null;
    // private _async: Async;
    // private _events: EventGroup;

    this.averageHeight = 50;
    this.itemCountMargin = 20;
    this.virtualizedData = {
      subSetOfItems: [],
      numItemsToShow: 20,
      numItemsToSkipAfter: 0,
      numItemsToSkipBefore: 0
    }; // this.state = { pages:[]};
    // this.state.isScrolling = false;
    // this._async = new Async(this);
    // this._events = new EventGroup(this);

    this._estimatedPageHeight = 0;
    this._totalEstimates = 0;
    this._requiredWindowsAhead = 0;
    this._requiredWindowsBehind = 0; // Track the measure version for everything.

    this._measureVersion = 0; // this._onAsyncIdle = this._async.debounce(this._onAsyncIdle, IDLE_DEBOUNCE_DELAY, {
    //     leading: false,
    // });
    // this._onAsyncResize = this._async.debounce(this._onAsyncResize, RESIZE_DELAY, {
    //     leading: false,
    // });
    // this._onScrollingDone = this._async.debounce(this._onScrollingDone, DONE_SCROLLING_WAIT, {
    // leading: false,
    // });

    this._cachedPageHeights = {};
    this._estimatedPageHeight = 0;
    this._focusedIndex = -1; //this._pageCache = {};
    //this.getPageSpecification=undefined;
    //this.onRenderCell = (a,b,c) => html<T>`${x=>x}`;
  }

  itemsChanged(oldValue, newValue) {
    this.propertyChanged(true);
  }

  connectedCallback() {
    super.connectedCallback(); //const rootMargin: number = 500;

    this.intersectionObserver = new IntersectionObserver((entries, observer) => {
      //DOM.queueUpdate(() => {
      entries.forEach(entry => {
        var _a;

        if (!entry.isIntersecting) {
          return;
        }

        const containerSize = (_a = entry.rootBounds) === null || _a === void 0 ? void 0 : _a.height;

        if (entry.target === this.spacerBefore) {
          this.onSpacerTrigger('before', entry.intersectionRect.top - entry.boundingClientRect.top, containerSize);
        } else if (entry.target === this.spacerAfter) {
          this.onSpacerTrigger('after', entry.boundingClientRect.bottom - entry.intersectionRect.bottom, containerSize);
        } else {
          throw new Error('Unknown intersection target');
        }
      }); //});
    }, {
      root: this.scrollElement,
      rootMargin: '20px'
    });
    this.intersectionObserver.observe(this.spacerBefore);
    this.intersectionObserver.observe(this.spacerAfter); // After each render, refresh the info about intersections

    this.mutationObserverBefore = new MutationObserver(mutations => {
      //DOM.queueUpdate(_=>{
      this.intersectionObserver.unobserve(this.spacerBefore);
      this.intersectionObserver.observe(this.spacerBefore); //});
    });
    this.mutationObserverAfter = new MutationObserver(mutations => {
      //DOM.queueUpdate(_=>{
      this.intersectionObserver.unobserve(this.spacerAfter);
      this.intersectionObserver.observe(this.spacerAfter); //});
    }); //this.mutationObserverBefore.observe(this.spacerBefore, { attributes: true });
    //this.mutationObserverAfter.observe(this.spacerAfter, { attributes: true });
  }

  onSpacerTrigger(spacerType, spacerSize, containerSize) {
    let itemCount = this.items !== undefined ? this.items.length : 0;
    let numItemsToShow = Math.ceil(containerSize / this.averageHeight) + 2;
    numItemsToShow = Math.max(0, Math.min(numItemsToShow, itemCount));

    if (spacerType == "before") {
      let numItemsToSkipBefore = Math.max(0, Math.floor(spacerSize / this.averageHeight) - 1);
      let numItemsToSkipAfter = Math.max(0, itemCount - numItemsToShow - numItemsToSkipBefore); //let subSetOfItems = this.items?.slice(numItemsToSkipBefore, numItemsToSkipBefore + numItemsToShow);

      this.changeSubset(numItemsToShow, numItemsToSkipBefore, this.virtualizedData.subSetOfItems);
      let newVirtdata = {
        subSetOfItems: this.virtualizedData.subSetOfItems,
        numItemsToSkipBefore: numItemsToSkipBefore,
        numItemsToShow: numItemsToShow,
        numItemsToSkipAfter: numItemsToSkipAfter
      };

      if (newVirtdata.numItemsToSkipBefore != this.virtualizedData.numItemsToSkipBefore || newVirtdata.numItemsToSkipAfter != this.virtualizedData.numItemsToSkipAfter || newVirtdata.numItemsToShow != this.virtualizedData.numItemsToShow) {
        this.virtualizedData = newVirtdata;
      }

      this.intersectionObserver.unobserve(this.spacerBefore);
      this.intersectionObserver.observe(this.spacerBefore); //});
    } else if (spacerType == "after") {
      //DOM.queueUpdate(()=>{
      let numItemsToSkipAfter = Math.max(0, Math.floor(spacerSize / this.averageHeight) - 1);
      let numItemsToSkipBefore = Math.max(0, itemCount - numItemsToShow - numItemsToSkipAfter); //let subSetOfItems = this.items?.slice(numItemsToSkipBefore, numItemsToSkipBefore + numItemsToShow);

      this.changeSubset(numItemsToShow, numItemsToSkipBefore, this.virtualizedData.subSetOfItems);
      let newVirtdata = {
        subSetOfItems: this.virtualizedData.subSetOfItems,
        numItemsToSkipBefore: numItemsToSkipBefore,
        numItemsToShow: numItemsToShow,
        numItemsToSkipAfter: numItemsToSkipAfter
      };

      if (newVirtdata.numItemsToSkipBefore != this.virtualizedData.numItemsToSkipBefore || newVirtdata.numItemsToSkipAfter != this.virtualizedData.numItemsToSkipAfter || newVirtdata.numItemsToShow != this.virtualizedData.numItemsToShow) {
        //  DOM.queueUpdate(()=>{
        this.virtualizedData = newVirtdata; //});
      }

      this.intersectionObserver.unobserve(this.spacerAfter);
      this.intersectionObserver.observe(this.spacerAfter); //});
    }
  }

  changeSubset(totalToTake, numberToSkipFirst, subset) {
    if (this.items === undefined) {
      return;
    }

    if (subset.length == 0 && this.items !== undefined) {
      var itemsToAdd = this.items.slice(numberToSkipFirst, numberToSkipFirst + totalToTake);
      let transformed = itemsToAdd.map((v, i) => {
        return {
          index: i + numberToSkipFirst,
          item: v
        };
      });
      subset.push(...transformed);
    } // before


    let currentStartIndex = subset[0].index; //let currentStartIndex = this.items.indexOf(subset[0]);

    if (numberToSkipFirst > currentStartIndex) {
      //need to remove items from subset start
      subset.splice(0, numberToSkipFirst - currentStartIndex);
    } else if (numberToSkipFirst < currentStartIndex) {
      //need to add more items to subset start
      subset.splice(0, 0, ...this.items.slice(numberToSkipFirst, currentStartIndex).map((v, i) => {
        return {
          item: v,
          index: i + numberToSkipFirst
        };
      }));
    } // after


    if (subset.length > totalToTake) {
      //too many on subset... truncate it
      subset.splice(totalToTake, subset.length - totalToTake);
    } else if (subset.length < totalToTake) {
      //not enough, need more from the original array
      let startIndex = numberToSkipFirst + subset.length;
      subset.push(...this.items.slice(startIndex, numberToSkipFirst + totalToTake).map((v, i) => {
        return {
          item: v,
          index: i + startIndex
        };
      }));
    }
  }

  initialListDrawing() {
    let subSetOfItems;
    let numItemsToShow = 0;
    let numItemsToSkipAfter = 0;

    if (this.items != undefined) {
      subSetOfItems = this.items.slice(0, Math.min(this.items.length, 20)).map((v, i) => {
        return {
          item: v,
          index: i
        };
      });
      numItemsToShow = Math.min(this.items.length, 20);
      numItemsToSkipAfter = Math.max(0, this.items.length - 20);
    } else {
      subSetOfItems = [];
    } //var visibleBottom = visibleRect.top + visibleRect.height;
    //var lastVisibleItemIndex = this.numItemsToSkipBefore + this.numItemsToShow + Math.ceil(visibleBottom / this.averageHeight);
    //this.numItemsToShow = 20;
    //this.numItemsToSkipAfter = this.items.length - this.numItemsToSkipBefore - this.numItemsToShow;


    let newVirtdata = {
      subSetOfItems: subSetOfItems,
      numItemsToSkipBefore: 0,
      numItemsToShow: numItemsToShow,
      numItemsToSkipAfter: numItemsToSkipAfter
    };
    this.virtualizedData = newVirtdata;
  }

  disconnectedCallback() {
    super.disconnectedCallback(); // this._async.dispose();
    // this._events.dispose();
    //delete this._scrollElement;
  }

  propertyChanged(needsReset) {
    if (needsReset) {
      // this._resetRequiredWindows();
      // this._requiredRect = null;
      this.initialListDrawing(); // this._measureVersion++;
      // this._invalidatePageCache();
      // this._updatePages();

      console.log("Reset pages again");
    } //console.log(JSON.stringify(this.items)); 

  }

  _onFocus(ev) {
    let target = ev.target;

    while (target !== this._surface) {
      const indexString = target.getAttribute('data-list-index');

      if (indexString) {
        this._focusedIndex = Number(indexString);
        break;
      } //target = getParent(target) as HTMLElement;

    }
  } // public forceUpdate(): void {
  //     this._invalidatePageCache();
  //     // Ensure that when the list is force updated we update the pages first before render.
  //     this._updateRenderRects(true);
  //     this._updatePages();
  //     this._measureVersion++;
  //     //super.forceUpdate();
  //   }
  // private _onAsyncResize(): void {
  //     this.forceUpdate();
  // }
  // private _invalidatePageCache(): void {
  //     this._pageCache = {};
  // }


  _resetRequiredWindows() {
    this._requiredWindowsAhead = 0;
    this._requiredWindowsBehind = 0;
  } // private _updatePages(): void {
  //     // console.log('updating pages');
  //     if (!this._requiredRect) {
  //       this._updateRenderRects();
  //     }
  //     const newListState = this._buildPages();
  //     const oldListPages = this.state.pages!;
  //     this._notifyPageChanges(oldListPages, newListState.pages!);
  //     this.stateChangedFunc = (state)=> {
  //         const finalState : IListState<T> = {measureVersion: state.measureVersion, pages: state.pages, isScrolling: state.isScrolling };
  //         // If we weren't provided with the page height, measure the pages
  //         if (!this.getPageHeight) {
  //             // If measured version is invalid since we've updated the DOM
  //             const heightsChanged = this._updatePageMeasurements(finalState.pages!);
  //             // On first render, we should re-measure so that we don't get a visual glitch.
  //             if (heightsChanged) {
  //                 this._materializedRect = null;
  //                 if (!this._hasCompletedFirstRender) {
  //                     this._hasCompletedFirstRender = true;
  //                     this._updatePages();
  //                 } else {
  //                     this._onAsyncScroll();
  //                 }
  //             } else {
  //                   // Enqueue an idle bump.
  //                   this._onAsyncIdle();
  //             }
  //         } else {
  //               // Enqueue an idle bump
  //               this._onAsyncIdle();
  //         }
  //         // Notify the caller that rendering the new pages has completed
  //         if (this.onPagesUpdated) {
  //           this.onPagesUpdated(finalState.pages as IPage2<T>[]);
  //         }
  //     };
  //     this.state = newListState;
  //     // if (newListState.measureVersion !== undefined)
  //     //     this.measureVersion = newListState.measureVersion;
  //     // if (newListState.isScrolling !== undefined)
  //     //     this.isScrolling = newListState.isScrolling;
  //     // if (newListState.pages)
  //     //     this.pages = newListState.pages;
  //     //this.setState(newListState, () => {
  //       // Multiple updates may have been queued, so the callback will reflect all of them.
  //       // Re-fetch the current props and states to avoid using a stale props or state captured in the closure.
  //     //});
  // }

  /**
  * Debounced method to asynchronously update the visible region on a scroll event.
  */
  // private _onAsyncScroll(): void {
  //     this._updateRenderRects();
  //     console.log("Scrolling!");
  //     // Only update pages when the visible rect falls outside of the materialized rect.
  //     if (!this._materializedRect || !_isContainedWithin(this._requiredRect as IRectangle, this._materializedRect)) {
  //         this._updatePages();
  //     } else {
  //         // console.log('requiredRect contained in materialized', this._requiredRect, this._materializedRect);
  //     }
  // }

  /**
   * This is an async debounced method that will try and increment the windows we render. If we can increment
   * either, we increase the amount we render and re-evaluate.
   */
  // private _onAsyncIdle(): void {
  //     //const { renderedWindowsAhead, renderedWindowsBehind } = this.props;
  //     const { _requiredWindowsAhead: requiredWindowsAhead, _requiredWindowsBehind: requiredWindowsBehind } = this;
  //     const windowsAhead = Math.min(this.renderedWindowsAhead as number, requiredWindowsAhead + 1);
  //     const windowsBehind = Math.min(this.renderedWindowsBehind as number, requiredWindowsBehind + 1);
  //     console.log('idling', windowsBehind, windowsAhead);
  //     if (windowsAhead !== requiredWindowsAhead || windowsBehind !== requiredWindowsBehind) {
  //         this._requiredWindowsAhead = windowsAhead;
  //         this._requiredWindowsBehind = windowsBehind;
  //         this._updateRenderRects();
  //         this._updatePages();
  //     }
  //     if (this.renderedWindowsAhead! > windowsAhead || this.renderedWindowsBehind! > windowsBehind) {
  //         // Async increment on next tick.
  //         this._onAsyncIdle();
  //     }
  // }
  // private _updateRenderRects(forceUpdate?: boolean): void {
  //     // when not in virtualize mode, we render all items without measurement to optimize page rendering perf
  //     if (!this._shouldVirtualize()) {
  //       return;
  //     }
  //     let surfaceRect = this._surfaceRect || { ...EMPTY_RECT };
  //     const scrollHeight = this._scrollElement && this._scrollElement.scrollHeight;
  //     const scrollTop = this._scrollElement ? this._scrollElement.scrollTop : 0;
  //     // WARNING: EXPENSIVE CALL! We need to know the surface top relative to the window.
  //     // This needs to be called to recalculate when new pages should be loaded.
  //     // We check to see how far we've scrolled and if it's further than a third of a page we run it again.
  //     if (
  //       this._surface &&
  //       (forceUpdate ||
  //         !this.state.pages ||
  //         !this._surfaceRect ||
  //         !scrollHeight ||
  //         scrollHeight !== this._scrollHeight ||
  //         Math.abs(this._scrollTop - scrollTop) > this._estimatedPageHeight / 3)
  //     ) {
  //       surfaceRect = this._surfaceRect = _measureSurfaceRect(this._surface);
  //       this._scrollTop = scrollTop;
  //     }
  //     // If the scroll height has changed, something in the container likely resized and
  //     // we should redo the page heights incase their content resized.
  //     if (forceUpdate || !scrollHeight || scrollHeight !== this._scrollHeight) {
  //       this._measureVersion++;
  //     }
  //     this._scrollHeight = scrollHeight;
  //     // If the surface is above the container top or below the container bottom, or if this is not the first
  //     // render return empty rect.
  //     // The first time the list gets rendered we need to calculate the rectangle. The width of the list is
  //     // used to calculate the width of the list items.
  //     const visibleTop = Math.max(0, -surfaceRect.top);
  //     const win = getWindow(this._root);
  //     const visibleRect = {
  //       top: visibleTop,
  //       left: surfaceRect.left,
  //       bottom: visibleTop + win!.innerHeight,
  //       right: surfaceRect.right,
  //       width: surfaceRect.width,
  //       height: win!.innerHeight,
  //     };
  //     // The required/allowed rects are adjusted versions of the visible rect.
  //     this._requiredRect = _expandRect(visibleRect, this._requiredWindowsBehind, this._requiredWindowsAhead);
  //     this._allowedRect = _expandRect(visibleRect, this.renderedWindowsBehind!, this.renderedWindowsAhead!);
  //     // store the visible rect for later use.
  //     this._visibleRect = visibleRect;
  // }
  // private _updatePageMeasurements(pages: IPage2<T>[]): boolean {
  //     let heightChanged = false;
  //     // when not in virtualize mode, we render all the items without page measurement
  //     if (!this._shouldVirtualize()) {
  //       return heightChanged;
  //     }
  //     for (let i = 0; i < pages.length; i++) {
  //       const page = pages[i];
  //       if (page.items) {
  //         heightChanged = this._measurePage(page) || heightChanged;
  //       }
  //     }
  //     //console.log("pageHeight " + heightChanged);
  //     //console.log(this._cachedPageHeights);
  //     return heightChanged;
  //   }
  // private _measurePage(page: IPage2<T>): boolean {
  //     let hasChangedHeight = false;
  //     // eslint-disable-next-line react/no-string-refs
  //     //console.log("ref length: " + this._refs.length);
  //     //this._refs.forEach(x=> console.log(x));
  //     const pageElement = this._refs.find(x=> (x as HTMLElement)?.dataset?.pageKey == page.key) as HTMLElement;
  //     const cachedHeight = this._cachedPageHeights[page.startIndex];
  //     // console.log('   * measure attempt', page.startIndex, cachedHeight);
  //     //console.log("wanted pageKey: " + page.key);
  //     //console.log("pageElement: " + pageElement);
  //     if (
  //       pageElement &&
  //       this._shouldVirtualize() &&
  //       (!cachedHeight || cachedHeight.measureVersion !== this._measureVersion)
  //     ) {
  //       const newClientRect = {
  //         width: pageElement.clientWidth,
  //         height: pageElement.clientHeight,
  //       };
  //       if (newClientRect.height || newClientRect.width) {
  //         hasChangedHeight = page.height !== newClientRect.height;
  //         // console.warn(' *** expensive page measure', page.startIndex, page.height, newClientRect.height);
  //         page.height = newClientRect.height;
  //         this._cachedPageHeights[page.startIndex] = {
  //           height: newClientRect.height,
  //           measureVersion: this._measureVersion,
  //         };
  //         this._estimatedPageHeight = Math.round(
  //           (this._estimatedPageHeight * this._totalEstimates + newClientRect.height) / (this._totalEstimates + 1),
  //         );
  //         this._totalEstimates++;
  //       }
  //     }
  //     return hasChangedHeight;
  //   }
  // private _buildPages(): IListState<T> {
  //     //let { renderCount } = props;
  //     //const { items, startIndex, getPageHeight } = props;
  //     let renderCount = this._getRenderCount();
  //     const materializedRect = { ...EMPTY_RECT };
  //     const pages: IPage2<T>[] = [];
  //     let itemsPerPage = 1;
  //     let pageTop = 0;
  //     let currentSpacer : IPage2<T>|null = null;
  //     const focusedIndex = this._focusedIndex;
  //     const endIndex = this.startIndex! + renderCount;
  //     const shouldVirtualize = this._shouldVirtualize();
  //     // First render is very important to track; when we render cells, we have no idea of estimated page height.
  //     // So we should default to rendering only the first page so that we can get information.
  //     // However if the user provides a measure function, let's just assume they know the right heights.
  //     const isFirstRender = this._estimatedPageHeight === 0 && !this.getPageHeight;
  //     const allowedRect = this._allowedRect;
  //     //console.log("s " + this.startIndex + " e " + endIndex);
  //     for (let itemIndex = this.startIndex!; itemIndex < endIndex; itemIndex += itemsPerPage) {
  //         //console.log(itemIndex);
  //         const pageSpecification = this._getPageSpecification(itemIndex, allowedRect);
  //         const pageHeight = pageSpecification.height;
  //         const pageData = pageSpecification.data;
  //         const key = pageSpecification.key;
  //         itemsPerPage = pageSpecification.itemCount;
  //         const pageBottom = pageTop + pageHeight - 1;
  //         const isPageRendered =
  //             findIndex(this.state.pages as IPage2<T>[], (page: IPage2<T>) => !!page.items && page.startIndex === itemIndex) >
  //             -1;
  //         const isPageInAllowedRange = !allowedRect || (pageBottom >= allowedRect.top && pageTop <= allowedRect.bottom!);
  //         const isPageInRequiredRange =
  //             !this._requiredRect || (pageBottom >= this._requiredRect.top && pageTop <= this._requiredRect.bottom!);
  //         const isPageVisible =
  //             (!isFirstRender && (isPageInRequiredRange || (isPageInAllowedRange && isPageRendered))) || !shouldVirtualize;
  //         const isPageFocused = focusedIndex >= itemIndex && focusedIndex < itemIndex + itemsPerPage;
  //         const isFirstPage = itemIndex === this.startIndex;
  //         // console.log('building page', itemIndex, 'pageTop: ' + pageTop, 'inAllowed: ' +
  //         // isPageInAllowedRange, 'inRequired: ' + isPageInRequiredRange);
  //         // Only render whats visible, focused, or first page,
  //         // or when running in fast rendering mode (not in virtualized mode), we render all current items in pages
  //         if (isPageVisible || isPageFocused || isFirstPage) {
  //             if (currentSpacer) {
  //                 pages.push(currentSpacer);
  //                 currentSpacer = null;
  //             }
  //             const itemsInPage = Math.min(itemsPerPage, endIndex - itemIndex);
  //             const newPage = this._createPage(
  //                 key,
  //                 this.items!.slice(itemIndex, itemIndex + itemsInPage),
  //                 itemIndex,
  //                 undefined,
  //                 undefined,
  //                 pageData,
  //             );
  //             newPage.top = pageTop;
  //             newPage.height = pageHeight;
  //             if (this._visibleRect && this._visibleRect.bottom) {
  //                 newPage.isVisible = pageBottom >= this._visibleRect.top && pageTop <= this._visibleRect.bottom;
  //             }
  //             pages.push(newPage);
  //             if (isPageInRequiredRange && this._allowedRect) {
  //                 _mergeRect(materializedRect, {
  //                     top: pageTop,
  //                     bottom: pageBottom,
  //                     height: pageHeight,
  //                     left: allowedRect.left,
  //                     right: allowedRect.right,
  //                     width: allowedRect.width,
  //                 });
  //             }
  //         } else {
  //             if (!currentSpacer) {
  //                 currentSpacer = this._createPage(
  //                     SPACER_KEY_PREFIX + itemIndex,
  //                     undefined,
  //                     itemIndex,
  //                     0,
  //                     undefined,
  //                     pageData,
  //                     true /*isSpacer*/,
  //                 );
  //             }
  //             currentSpacer.height = (currentSpacer.height || 0) + (pageBottom - pageTop) + 1;
  //             currentSpacer.itemCount += itemsPerPage;
  //       }
  //       pageTop += pageBottom - pageTop + 1;
  //         // in virtualized mode, we render need to render first page then break and measure,
  //         // otherwise, we render all items without measurement to make rendering fast
  //         if (isFirstRender && shouldVirtualize) {
  //             break;
  //         }
  //     }
  //     if (currentSpacer) {
  //         currentSpacer.key = SPACER_KEY_PREFIX + 'end';
  //         pages.push(currentSpacer);
  //     }
  //     this._materializedRect = materializedRect;
  //     // console.log('materialized: ', materializedRect);
  //     return {
  //         pages: pages,
  //         measureVersion: this._measureVersion,
  //     };
  // }
  // private _createPage(
  //     pageKey: string | undefined,
  //     items: any[] | undefined,
  //     startIndex: number = -1,
  //     count: number = items ? items.length : 0,
  //     style: React.CSSProperties = {},
  //     data?: any,
  //     isSpacer?: boolean,
  //   ): IPage2<T> {
  //     pageKey = pageKey || PAGE_KEY_PREFIX + startIndex;
  //     const cachedPage = this._pageCache[pageKey];
  //     if (cachedPage && cachedPage.page) {
  //       return cachedPage.page;
  //     }
  //     return {
  //       key: pageKey,
  //       startIndex: startIndex,
  //       itemCount: count,
  //       items: items,
  //       style: style,
  //       top: 0,
  //       height: 0,
  //       data: data,
  //       isSpacer: isSpacer || false,
  //       getKey: this.getKey,
  //       onRenderCell:this.onRenderCell
  //     };
  //   }
  // private _notifyPageChanges(oldPages: IPage2<T>[], newPages: IPage2<T>[]): void {
  //     // if (this.onPageAdded || this.onPageRemoved) {
  //     //     const renderedIndexes: {
  //     //     [index: number]: IPage2<T>;
  //     //     } = {};
  //     //     for (const page of oldPages) {
  //     //     if (page.items) {
  //     //         renderedIndexes[page.startIndex] = page;
  //     //     }
  //     //     }
  //     //     for (const page of newPages) {
  //     //     if (page.items) {
  //     //         if (!renderedIndexes[page.startIndex]) {
  //     //         this._onPageAdded(page);
  //     //         } else {
  //     //         delete renderedIndexes[page.startIndex];
  //     //         }
  //     //     }
  //     //     }
  //     //     for (const index in renderedIndexes) {
  //     //     if (renderedIndexes.hasOwnProperty(index)) {
  //     //         this._onPageRemoved(renderedIndexes[index]);
  //     //     }
  //     //     }
  //     // }
  // }
  // /** Called when a page has been added to the DOM. */
  // private _onPageAdded(page: IPage2<T>): void {        
  //     if (this.onPageAdded) {
  //         this.onPageAdded(page);
  //     }
  // }
  // /** Called when a page has been removed from the DOM. */
  // private _onPageRemoved(page: IPage2<T>): void {
  //     if (this.onPageRemoved) {
  //         this.onPageRemoved(page);
  //     }
  // }


  _shouldVirtualize() {
    return !this.onShouldVirtualize || this.onShouldVirtualize(this);
  }

  _getRenderCount() {
    return this.renderCount === undefined ? this.items ? this.items.length - this.startIndex : 0 : this.renderCount;
  }

};

__decorate([observable], FluentList.prototype, "items", void 0);

__decorate([observable], FluentList.prototype, "onRenderCell", void 0);

__decorate([attr], FluentList.prototype, "ignoreScrollingState", void 0);

__decorate([attr], FluentList.prototype, "renderCount", void 0);

__decorate([attr], FluentList.prototype, "renderedWindowsAhead", void 0);

__decorate([attr], FluentList.prototype, "renderedWindowsBehind", void 0);

__decorate([attr], FluentList.prototype, "startIndex", void 0);

__decorate([observable], FluentList.prototype, "averageHeight", void 0);

__decorate([observable], FluentList.prototype, "virtualizedData", void 0);

__decorate([observable], FluentList.prototype, "_refs", void 0);

__decorate([observable], FluentList.prototype, "_measureVersion", void 0);

FluentList = __decorate([customElement({
  name: "fast-fluent-list",
  template: ListTemplate,
  styles: ListStyles,
  shadowOptions: {
    delegatesFocus: true
  }
})], FluentList);
//     const top = rect.top - pagesBefore * rect.height;
//     const height = rect.height + (pagesBefore + pagesAfter) * rect.height;
//     return {
//       top: top,
//       bottom: top + height,
//       height: height,
//       left: rect.left,
//       right: rect.right,
//       width: rect.width,
//     };
// }
// function _isContainedWithin(innerRect: IRectangle, outerRect: IRectangle): boolean {
//     return (
//         innerRect.top >= outerRect.top &&
//         innerRect.left >= outerRect.left &&
//         innerRect.bottom! <= outerRect.bottom! &&
//         innerRect.right! <= outerRect.right!
//     );
// }
// function _mergeRect(targetRect: IRectangle, newRect: IRectangle): IRectangle {
//     targetRect.top = newRect.top < targetRect.top || targetRect.top === -1 ? newRect.top : targetRect.top;
//     targetRect.left = newRect.left < targetRect.left || targetRect.left === -1 ? newRect.left : targetRect.left;
//     targetRect.bottom =
//         newRect.bottom! > targetRect.bottom! || targetRect.bottom === -1 ? newRect.bottom : targetRect.bottom;
//     targetRect.right = newRect.right! > targetRect.right! || targetRect.right === -1 ? newRect.right : targetRect.right;
//     targetRect.width = targetRect.right! - targetRect.left + 1;
//     targetRect.height = targetRect.bottom! - targetRect.top + 1;
//     return targetRect;
// }

/**
 * Some states and properties are applicable to all host language elements regardless of whether a role is applied.
 * The following global states and properties are supported by all roles and by all base markup elements.
 * {@link https://www.w3.org/TR/wai-aria-1.1/#global_states}
 *
 * This is intended to be used as a mixin. Be sure you extend FASTElement.
 *
 * @public
 */

class ARIAGlobalStatesAndProperties$1 {}

__decorate([attr({
  attribute: "aria-atomic",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaAtomic", void 0);

__decorate([attr({
  attribute: "aria-busy",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaBusy", void 0);

__decorate([attr({
  attribute: "aria-controls",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaControls", void 0);

__decorate([attr({
  attribute: "aria-current",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaCurrent", void 0);

__decorate([attr({
  attribute: "aria-describedby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaDescribedby", void 0);

__decorate([attr({
  attribute: "aria-details",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaDetails", void 0);

__decorate([attr({
  attribute: "aria-disabled",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaDisabled", void 0);

__decorate([attr({
  attribute: "aria-errormessage",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaErrormessage", void 0);

__decorate([attr({
  attribute: "aria-flowto",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaFlowto", void 0);

__decorate([attr({
  attribute: "aria-haspopup",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaHaspopup", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaHidden", void 0);

__decorate([attr({
  attribute: "aria-invalid",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaInvalid", void 0);

__decorate([attr({
  attribute: "aria-keyshortcuts",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaKeyshortcuts", void 0);

__decorate([attr({
  attribute: "aria-label",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaLabel", void 0);

__decorate([attr({
  attribute: "aria-labelledby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-live",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaLive", void 0);

__decorate([attr({
  attribute: "aria-owns",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaOwns", void 0);

__decorate([attr({
  attribute: "aria-relevant",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaRelevant", void 0);

__decorate([attr({
  attribute: "aria-roledescription",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties$1.prototype, "ariaRoledescription", void 0);

/**
 * The template for the end element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const endTemplate$1 = html`<span part="end" ${ref("endContainer")}><slot name="end" ${ref("end")}@slotchange="${x => x.handleEndContentChange()}"></slot></span>`;
/**
 * The template for the start element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const startTemplate$1 = html`<span part="start" ${ref("startContainer")}><slot name="start" ${ref("start")}@slotchange="${x => x.handleStartContentChange()}"></slot></span>`;

const FluentTextFieldTemplate = html`<template tabindex="${x => x.disabled ? null : 0}" class=" ${x => x.readOnly ? "readonly" : ""} ${x => x.label && x.label.length > 0 ? "" : "no-label"}">${when(x => x.label && x.label.length > 0, html`<fast-fluent-label for="control" disabled="${x => x.disabled}" required="${x => x.required}">${x => x.label}</fast-fluent-label>`)}<div class="root" part="root">${startTemplate$1}<input class="control" part="control" id="control" @input="${x => x.handleTextInput()}" placeholder="${x => x.placeholder}" ?required="${x => x.required}" ?disabled="${x => x.disabled}" ?readonly="${x => x.readOnly}" value="${x => x.value}" type="${x => x.type}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaDisabled}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}/>${endTemplate$1}</div></template>`;

function performOperation(operation) {
  return (...args) => {
    return designSystem => {
      const firstArg = args[0];
      let value = typeof firstArg === "function" ? firstArg(designSystem) : firstArg;

      for (let i = 1; i < args.length; i++) {
        const currentValue = args[i];
        value = operation(value, typeof currentValue === "function" ? currentValue(designSystem) : currentValue);
      }

      return value;
    };
  };
}

const _add = performOperation((a, b) => a + b);

const _subtract = performOperation((a, b) => a - b);

const _multiply = performOperation((a, b) => a * b);
/**
 * Adds numbers or functions that accept a design system and return a number.
 */


function add(...args) {
  return _add.apply(this, args);
}
/**
 * Subtract numbers or functions that accept a design system and return a number.
 */

function subtract(...args) {
  return _subtract.apply(this, args);
}
/**
 * Multiplies numbers or functions that accept a design system and return a number.
 */

function multiply(...args) {
  return _multiply.apply(this, args);
}

/**
 * Ensures that an input number does not exceed a max value and is not less than a min value.
 * @param i - the number to clamp
 * @param min - the maximum (inclusive) value
 * @param max - the minimum (inclusive) value
 * @public
 */
function clamp(i, min, max) {
  if (isNaN(i) || i <= min) {
    return min;
  } else if (i >= max) {
    return max;
  }

  return i;
}
/**
 * Scales an input to a number between 0 and 1
 * @param i - a number between min and max
 * @param min - the max value
 * @param max - the min value
 * @public
 */

function normalize(i, min, max) {
  if (isNaN(i) || i <= min) {
    return 0.0;
  } else if (i >= max) {
    return 1.0;
  }

  return i / (max - min);
}
/**
 * Scales a number between 0 and 1
 * @param i - the number to denormalize
 * @param min - the min value
 * @param max - the max value
 * @public
 */

function denormalize(i, min, max) {
  if (isNaN(i)) {
    return min;
  }

  return min + i * (max - min);
}
/**
 * Converts degrees to radians.
 * @param i - degrees
 * @public
 */

function degreesToRadians(i) {
  return i * (Math.PI / 180.0);
}
/**
 * Converts radians to degrees.
 * @param i - radians
 * @public
 */

function radiansToDegrees(i) {
  return i * (180.0 / Math.PI);
}
/**
 * Converts a number between 0 and 255 to a hex string.
 * @param i - the number to convert to a hex string
 * @public
 */

function getHexStringForByte(i) {
  const s = Math.round(clamp(i, 0.0, 255.0)).toString(16);

  if (s.length === 1) {
    return "0" + s;
  }

  return s;
}
/**
 * Linearly interpolate
 * @public
 */

function lerp(i, min, max) {
  if (isNaN(i) || i <= 0.0) {
    return min;
  } else if (i >= 1.0) {
    return max;
  }

  return min + i * (max - min);
}
/**
 * Linearly interpolate angles in degrees
 * @public
 */

function lerpAnglesInDegrees(i, min, max) {
  if (i <= 0.0) {
    return min % 360.0;
  } else if (i >= 1.0) {
    return max % 360.0;
  }

  const a = (min - max + 360.0) % 360.0;
  const b = (max - min + 360.0) % 360.0;

  if (a <= b) {
    return (min - a * i + 360.0) % 360.0;
  }

  return (min + a * i + 360.0) % 360.0;
}
/**
 *
 * Will return infinity if i*10^(precision) overflows number
 * note that floating point rounding rules come into play here
 * so values that end up rounding on a .5 round to the nearest
 * even not always up so 2.5 rounds to 2
 * @param i - the number to round
 * @param precision - the precision to round to
 *
 * @public
 */

function roundToPrecisionSmall(i, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(i * factor) / factor;
}

/**
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 *
 * @public
 */

class ColorHSL {
  constructor(hue, sat, lum) {
    this.h = hue;
    this.s = sat;
    this.l = lum;
  }
  /**
   * Construct a {@link ColorHSL} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.h) && !isNaN(data.s) && !isNaN(data.l)) {
      return new ColorHSL(data.h, data.s, data.l);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.h === rhs.h && this.s === rhs.s && this.l === rhs.l;
  }
  /**
   * Returns a new {@link ColorHSL} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorHSL(roundToPrecisionSmall(this.h, precision), roundToPrecisionSmall(this.s, precision), roundToPrecisionSmall(this.l, precision));
  }
  /**
   * Returns the {@link ColorHSL} formatted as an object.
   */


  toObject() {
    return {
      h: this.h,
      s: this.s,
      l: this.l
    };
  }

}

/**
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 *
 * @public
 */

class ColorHSV {
  constructor(hue, sat, val) {
    this.h = hue;
    this.s = sat;
    this.v = val;
  }
  /**
   * Construct a {@link ColorHSV} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.h) && !isNaN(data.s) && !isNaN(data.v)) {
      return new ColorHSV(data.h, data.s, data.v);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.h === rhs.h && this.s === rhs.s && this.v === rhs.v;
  }
  /**
   * Returns a new {@link ColorHSV} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorHSV(roundToPrecisionSmall(this.h, precision), roundToPrecisionSmall(this.s, precision), roundToPrecisionSmall(this.v, precision));
  }
  /**
   * Returns the {@link ColorHSV} formatted as an object.
   */


  toObject() {
    return {
      h: this.h,
      s: this.s,
      v: this.v
    };
  }

}

/**
 * {@link https://en.wikipedia.org/wiki/CIELAB_color_space | CIELAB color space}
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorLAB {
  constructor(l, a, b) {
    this.l = l;
    this.a = a;
    this.b = b;
  }
  /**
   * Construct a {@link ColorLAB} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.l) && !isNaN(data.a) && !isNaN(data.b)) {
      return new ColorLAB(data.l, data.a, data.b);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.l === rhs.l && this.a === rhs.a && this.b === rhs.b;
  }
  /**
   * Returns a new {@link ColorLAB} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorLAB(roundToPrecisionSmall(this.l, precision), roundToPrecisionSmall(this.a, precision), roundToPrecisionSmall(this.b, precision));
  }
  /**
   * Returns the {@link ColorLAB} formatted as an object.
   */


  toObject() {
    return {
      l: this.l,
      a: this.a,
      b: this.b
    };
  }

}
ColorLAB.epsilon = 216 / 24389;
ColorLAB.kappa = 24389 / 27;

/**
 *
 * {@link https://en.wikipedia.org/wiki/CIELAB_color_space | CIELCH color space}
 *
 * This is a cylindrical representation of the CIELAB space useful for saturation operations
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorLCH {
  constructor(l, c, h) {
    this.l = l;
    this.c = c;
    this.h = h;
  }
  /**
   * Construct a {@link ColorLCH} from a config object.
   * @param data - the config object
   */


  static fromObject(data) {
    if (data && !isNaN(data.l) && !isNaN(data.c) && !isNaN(data.h)) {
      return new ColorLCH(data.l, data.c, data.h);
    }

    return null;
  }
  /**
   * Determines if one color is equal to another.
   * @param rhs - the color to compare
   */


  equalValue(rhs) {
    return this.l === rhs.l && this.c === rhs.c && this.h === rhs.h;
  }
  /**
   * Returns a new {@link ColorLCH} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorLCH(roundToPrecisionSmall(this.l, precision), roundToPrecisionSmall(this.c, precision), roundToPrecisionSmall(this.h, precision));
  }
  /**
   * Converts the {@link ColorLCH} to a config object.
   */


  toObject() {
    return {
      l: this.l,
      c: this.c,
      h: this.h
    };
  }

}

/**
 * A RGBA color with 64 bit channels.
 *
 * @example
 * ```ts
 * new ColorRGBA64(1, 0, 0, 1) // red
 * ```
 * @public
 */

class ColorRGBA64 {
  /**
   *
   * @param red - the red value
   * @param green - the green value
   * @param blue - the blue value
   * @param alpha - the alpha value
   */
  constructor(red, green, blue, alpha) {
    this.r = red;
    this.g = green;
    this.b = blue;
    this.a = typeof alpha === "number" && !isNaN(alpha) ? alpha : 1;
  }
  /**
   * Construct a {@link ColorRGBA64} from a {@link ColorRGBA64Config}
   * @param data - the config object
   */


  static fromObject(data) {
    return data && !isNaN(data.r) && !isNaN(data.g) && !isNaN(data.b) ? new ColorRGBA64(data.r, data.g, data.b, data.a) : null;
  }
  /**
   * Determines if one color is equal to another.
   * @param rhs - the color to compare
   */


  equalValue(rhs) {
    return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
  }
  /**
   * Returns the color formatted as a string; #RRGGBB
   */


  toStringHexRGB() {
    return "#" + [this.r, this.g, this.b].map(this.formatHexValue).join("");
  }
  /**
   * Returns the color formatted as a string; #RRGGBBAA
   */


  toStringHexRGBA() {
    return this.toStringHexRGB() + this.formatHexValue(this.a);
  }
  /**
   * Returns the color formatted as a string; #AARRGGBB
   */


  toStringHexARGB() {
    return "#" + [this.a, this.r, this.g, this.b].map(this.formatHexValue).join("");
  }
  /**
   * Returns the color formatted as a string; "rgb(0xRR, 0xGG, 0xBB)"
   */


  toStringWebRGB() {
    return `rgb(${Math.round(denormalize(this.r, 0.0, 255.0))},${Math.round(denormalize(this.g, 0.0, 255.0))},${Math.round(denormalize(this.b, 0.0, 255.0))})`;
  }
  /**
   * Returns the color formatted as a string; "rgba(0xRR, 0xGG, 0xBB, a)"
   * @remarks
   * Note that this follows the convention of putting alpha in the range [0.0,1.0] while the other three channels are [0,255]
   */


  toStringWebRGBA() {
    return `rgba(${Math.round(denormalize(this.r, 0.0, 255.0))},${Math.round(denormalize(this.g, 0.0, 255.0))},${Math.round(denormalize(this.b, 0.0, 255.0))},${clamp(this.a, 0, 1)})`;
  }
  /**
   * Returns a new {@link ColorRGBA64} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorRGBA64(roundToPrecisionSmall(this.r, precision), roundToPrecisionSmall(this.g, precision), roundToPrecisionSmall(this.b, precision), roundToPrecisionSmall(this.a, precision));
  }
  /**
   * Returns a new {@link ColorRGBA64} with channel values clamped between 0 and 1.
   */


  clamp() {
    return new ColorRGBA64(clamp(this.r, 0, 1), clamp(this.g, 0, 1), clamp(this.b, 0, 1), clamp(this.a, 0, 1));
  }
  /**
   * Converts the {@link ColorRGBA64} to a {@link ColorRGBA64Config}.
   */


  toObject() {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    };
  }

  formatHexValue(value) {
    return getHexStringForByte(denormalize(value, 0.0, 255.0));
  }

}

/**
 * {@link https://en.wikipedia.org/wiki/CIE_1931_color_space | XYZ color space}
 *
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorXYZ {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  /**
   * Construct a {@link ColorXYZ} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.x) && !isNaN(data.y) && !isNaN(data.z)) {
      return new ColorXYZ(data.x, data.y, data.z);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }
  /**
   * Returns a new {@link ColorXYZ} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorXYZ(roundToPrecisionSmall(this.x, precision), roundToPrecisionSmall(this.y, precision), roundToPrecisionSmall(this.z, precision));
  }
  /**
   * Returns the {@link ColorXYZ} formatted as an object.
   */


  toObject() {
    return {
      x: this.x,
      y: this.y,
      z: this.z
    };
  }

}
/**
 * D65 2 degree white point
 */

ColorXYZ.whitePoint = new ColorXYZ(0.95047, 1.0, 1.08883);

// All conversions use the D65 2 degree white point for XYZ
// Info on conversions and constants used can be found in the following:
// https://en.wikipedia.org/wiki/CIELAB_color_space
// https://en.wikipedia.org/wiki/Illuminant_D65
// https://ninedegreesbelow.com/photography/xyz-rgb.html
// http://user.engineering.uiowa.edu/~aip/Misc/ColorFAQ.html
// https://web.stanford.edu/~sujason/ColorBalancing/adaptation.html
// http://brucelindbloom.com/index.html

/**
 * Get the luminance of a color in the linear RGB space.
 * This is not the same as the relative luminance in the sRGB space for WCAG contrast calculations. Use rgbToRelativeLuminance instead.
 * @param rgb - The input color
 *
 * @public
 */

function rgbToLinearLuminance(rgb) {
  return rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
}
/**
 * Get the relative luminance of a color.
 * Adjusts the color to sRGB space, which is necessary for the WCAG contrast spec.
 * The alpha channel of the input is ignored.
 * @param rgb - The input color
 *
 * @public
 */

function rgbToRelativeLuminance(rgb) {
  function luminanceHelper(i) {
    if (i <= 0.03928) {
      return i / 12.92;
    }

    return Math.pow((i + 0.055) / 1.055, 2.4);
  }

  return rgbToLinearLuminance(new ColorRGBA64(luminanceHelper(rgb.r), luminanceHelper(rgb.g), luminanceHelper(rgb.b), 1));
}

const calculateContrastRatio = (a, b) => (a + 0.05) / (b + 0.05);
/**
 * Calculate the contrast ratio between two colors. Uses the formula described by {@link https://www.w3.org/TR/WCAG20-TECHS/G17.html | WCAG 2.0}.
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */


function contrastRatio(a, b) {
  const luminanceA = rgbToRelativeLuminance(a);
  const luminanceB = rgbToRelativeLuminance(b);
  return luminanceA > luminanceB ? calculateContrastRatio(luminanceA, luminanceB) : calculateContrastRatio(luminanceB, luminanceA);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorHSL}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToHSL(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rgb.r) {
      hue = 60 * ((rgb.g - rgb.b) / delta % 6);
    } else if (max === rgb.g) {
      hue = 60 * ((rgb.b - rgb.r) / delta + 2);
    } else {
      hue = 60 * ((rgb.r - rgb.g) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  const lum = (max + min) / 2;
  let sat = 0;

  if (delta !== 0) {
    sat = delta / (1 - Math.abs(2 * lum - 1));
  }

  return new ColorHSL(hue, sat, lum);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorHSL} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param hsl - the hsl color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function hslToRGB(hsl, alpha = 1) {
  const c = (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;
  const x = c * (1 - Math.abs(hsl.h / 60 % 2 - 1));
  const m = hsl.l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hsl.h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hsl.h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hsl.h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hsl.h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hsl.h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hsl.h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return new ColorRGBA64(r + m, g + m, b + m, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorHSV}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToHSV(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rgb.r) {
      hue = 60 * ((rgb.g - rgb.b) / delta % 6);
    } else if (max === rgb.g) {
      hue = 60 * ((rgb.b - rgb.r) / delta + 2);
    } else {
      hue = 60 * ((rgb.r - rgb.g) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  let sat = 0;

  if (max !== 0) {
    sat = delta / max;
  }

  return new ColorHSV(hue, sat, max);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorHSV} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param hsv - the hsv color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function hsvToRGB(hsv, alpha = 1) {
  const c = hsv.s * hsv.v;
  const x = c * (1 - Math.abs(hsv.h / 60 % 2 - 1));
  const m = hsv.v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hsv.h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hsv.h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hsv.h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hsv.h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hsv.h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hsv.h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return new ColorRGBA64(r + m, g + m, b + m, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLCH} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param lch - the lch color to convert
 *
 * @public
 */

function lchToLAB(lch) {
  let a = 0;
  let b = 0;

  if (lch.h !== 0) {
    a = Math.cos(degreesToRadians(lch.h)) * lch.c;
    b = Math.sin(degreesToRadians(lch.h)) * lch.c;
  }

  return new ColorLAB(lch.l, a, b);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorLCH}
 * @param lab - the lab color to convert
 *
 * @remarks
 * The discontinuity in the C parameter at 0 means that floating point errors will often result in values near 0 giving unpredictable results.
 * EG: 0.0000001 gives a very different result than -0.0000001
 * More info about the atan2 function: {@link https://en.wikipedia.org/wiki/Atan2}
 * @public
 */

function labToLCH(lab) {
  let h = 0;

  if (lab.b !== 0 || lab.a !== 0) {
    h = radiansToDegrees(Math.atan2(lab.b, lab.a));
  }

  if (h < 0) {
    h += 360;
  }

  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  return new ColorLCH(lab.l, c, h);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorXYZ}
 * @param lab - the lab color to convert
 *
 * @public
 */

function labToXYZ(lab) {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const xcubed = Math.pow(fx, 3);
  const ycubed = Math.pow(fy, 3);
  const zcubed = Math.pow(fz, 3);
  let x = 0;

  if (xcubed > ColorLAB.epsilon) {
    x = xcubed;
  } else {
    x = (116 * fx - 16) / ColorLAB.kappa;
  }

  let y = 0;

  if (lab.l > ColorLAB.epsilon * ColorLAB.kappa) {
    y = ycubed;
  } else {
    y = lab.l / ColorLAB.kappa;
  }

  let z = 0;

  if (zcubed > ColorLAB.epsilon) {
    z = zcubed;
  } else {
    z = (116 * fz - 16) / ColorLAB.kappa;
  }

  x = ColorXYZ.whitePoint.x * x;
  y = ColorXYZ.whitePoint.y * y;
  z = ColorXYZ.whitePoint.z * z;
  return new ColorXYZ(x, y, z);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorXYZ} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param xyz - the xyz color to convert
 *
 * @public
 */

function xyzToLAB(xyz) {
  function xyzToLABHelper(i) {
    if (i > ColorLAB.epsilon) {
      return Math.pow(i, 1 / 3);
    }

    return (ColorLAB.kappa * i + 16) / 116;
  }

  const x = xyzToLABHelper(xyz.x / ColorXYZ.whitePoint.x);
  const y = xyzToLABHelper(xyz.y / ColorXYZ.whitePoint.y);
  const z = xyzToLABHelper(xyz.z / ColorXYZ.whitePoint.z);
  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);
  return new ColorLAB(l, a, b);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorXYZ}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 * @public
 */

function rgbToXYZ(rgb) {
  function rgbToXYZHelper(i) {
    if (i <= 0.04045) {
      return i / 12.92;
    }

    return Math.pow((i + 0.055) / 1.055, 2.4);
  }

  const r = rgbToXYZHelper(rgb.r);
  const g = rgbToXYZHelper(rgb.g);
  const b = rgbToXYZHelper(rgb.b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return new ColorXYZ(x, y, z);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorXYZ} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param xyz - the xyz color to convert
 * @param alpha - the alpha value
 *
 * @remarks
 * Note that the xyz color space is significantly larger than sRGB. As such, this can return colors rgb values greater than 1 or less than 0
 * @public
 */

function xyzToRGB(xyz, alpha = 1) {
  function xyzToRGBHelper(i) {
    if (i <= 0.0031308) {
      return i * 12.92;
    }

    return 1.055 * Math.pow(i, 1 / 2.4) - 0.055;
  }

  const r = xyzToRGBHelper(xyz.x * 3.2404542 - xyz.y * 1.5371385 - xyz.z * 0.4985314);
  const g = xyzToRGBHelper(xyz.x * -0.969266 + xyz.y * 1.8760108 + xyz.z * 0.041556);
  const b = xyzToRGBHelper(xyz.x * 0.0556434 - xyz.y * 0.2040259 + xyz.z * 1.0572252);
  return new ColorRGBA64(r, g, b, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToLAB(rgb) {
  return xyzToLAB(rgbToXYZ(rgb));
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param lab - the LAB color to convert
 * @param alpha - the alpha value
 *
 * @remarks
 * Note that the xyz color space (which the conversion from LAB uses) is significantly larger than sRGB. As such, this can return colors rgb values greater than 1 or less than 0
 *
 * @public
 */

function labToRGB(lab, alpha = 1) {
  return xyzToRGB(labToXYZ(lab), alpha);
}
/**
 * Convert a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorLCH}
 *
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToLCH(rgb) {
  return labToLCH(rgbToLAB(rgb));
}
/**
 * Convert a {@link @microsoft/fast-colors#ColorLCH} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param lch - the LCH color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function lchToRGB(lch, alpha = 1) {
  return labToRGB(lchToLAB(lch), alpha);
}

/**
 * Saturate a color using LCH color space
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function saturateViaLCH(input, saturation, saturationConstant = 18) {
  const lch = rgbToLCH(input);
  let sat = lch.c + saturation * saturationConstant;

  if (sat < 0) {
    sat = 0;
  }

  return lchToRGB(new ColorLCH(lch.l, sat, lch.h));
}
/**
 * @public
 */

function blendMultiplyChannel(bottom, top) {
  return bottom * top;
}
/**
 * Blends two colors with the multiply mode
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function blendMultiply(bottom, top) {
  return new ColorRGBA64(blendMultiplyChannel(bottom.r, top.r), blendMultiplyChannel(bottom.g, top.g), blendMultiplyChannel(bottom.b, top.b), 1);
}
/**
 * @public
 */

function blendOverlayChannel(bottom, top) {
  if (bottom < 0.5) {
    return clamp(2.0 * top * bottom, 0, 1);
  }

  return clamp(1.0 - 2.0 * (1.0 - top) * (1.0 - bottom), 0, 1);
}
/**
 * Blends two colors with the overlay mode
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function blendOverlay(bottom, top) {
  return new ColorRGBA64(blendOverlayChannel(bottom.r, top.r), blendOverlayChannel(bottom.g, top.g), blendOverlayChannel(bottom.b, top.b), 1);
}
/**
 * Color blend modes.
 * @public
 */

var ColorBlendMode;

(function (ColorBlendMode) {
  ColorBlendMode[ColorBlendMode["Burn"] = 0] = "Burn";
  ColorBlendMode[ColorBlendMode["Color"] = 1] = "Color";
  ColorBlendMode[ColorBlendMode["Darken"] = 2] = "Darken";
  ColorBlendMode[ColorBlendMode["Dodge"] = 3] = "Dodge";
  ColorBlendMode[ColorBlendMode["Lighten"] = 4] = "Lighten";
  ColorBlendMode[ColorBlendMode["Multiply"] = 5] = "Multiply";
  ColorBlendMode[ColorBlendMode["Overlay"] = 6] = "Overlay";
  ColorBlendMode[ColorBlendMode["Screen"] = 7] = "Screen";
})(ColorBlendMode || (ColorBlendMode = {}));

/**
 * Interpolate by RGB color space
 *
 * @public
 */

function interpolateRGB(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorRGBA64(lerp(position, left.r, right.r), lerp(position, left.g, right.g), lerp(position, left.b, right.b), lerp(position, left.a, right.a));
}
/**
 * Interpolate by HSL color space
 *
 * @public
 */

function interpolateHSL(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorHSL(lerpAnglesInDegrees(position, left.h, right.h), lerp(position, left.s, right.s), lerp(position, left.l, right.l));
}
/**
 * Interpolate by HSV color space
 *
 * @public
 */

function interpolateHSV(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorHSV(lerpAnglesInDegrees(position, left.h, right.h), lerp(position, left.s, right.s), lerp(position, left.v, right.v));
}
/**
 * Interpolate by XYZ color space
 *
 * @public
 */

function interpolateXYZ(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorXYZ(lerp(position, left.x, right.x), lerp(position, left.y, right.y), lerp(position, left.z, right.z));
}
/**
 * Interpolate by LAB color space
 *
 * @public
 */

function interpolateLAB(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorLAB(lerp(position, left.l, right.l), lerp(position, left.a, right.a), lerp(position, left.b, right.b));
}
/**
 * Interpolate by LCH color space
 *
 * @public
 */

function interpolateLCH(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorLCH(lerp(position, left.l, right.l), lerp(position, left.c, right.c), lerpAnglesInDegrees(position, left.h, right.h));
}
/**
 * Color interpolation spaces
 *
 * @public
 */

var ColorInterpolationSpace;

(function (ColorInterpolationSpace) {
  ColorInterpolationSpace[ColorInterpolationSpace["RGB"] = 0] = "RGB";
  ColorInterpolationSpace[ColorInterpolationSpace["HSL"] = 1] = "HSL";
  ColorInterpolationSpace[ColorInterpolationSpace["HSV"] = 2] = "HSV";
  ColorInterpolationSpace[ColorInterpolationSpace["XYZ"] = 3] = "XYZ";
  ColorInterpolationSpace[ColorInterpolationSpace["LAB"] = 4] = "LAB";
  ColorInterpolationSpace[ColorInterpolationSpace["LCH"] = 5] = "LCH";
})(ColorInterpolationSpace || (ColorInterpolationSpace = {}));
/**
 * Interpolate by color space
 *
 * @public
 */


function interpolateByColorSpace(position, space, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  switch (space) {
    case ColorInterpolationSpace.HSL:
      return hslToRGB(interpolateHSL(position, rgbToHSL(left), rgbToHSL(right)));

    case ColorInterpolationSpace.HSV:
      return hsvToRGB(interpolateHSV(position, rgbToHSV(left), rgbToHSV(right)));

    case ColorInterpolationSpace.XYZ:
      return xyzToRGB(interpolateXYZ(position, rgbToXYZ(left), rgbToXYZ(right)));

    case ColorInterpolationSpace.LAB:
      return labToRGB(interpolateLAB(position, rgbToLAB(left), rgbToLAB(right)));

    case ColorInterpolationSpace.LCH:
      return lchToRGB(interpolateLCH(position, rgbToLCH(left), rgbToLCH(right)));

    default:
      return interpolateRGB(position, left, right);
  }
}

/**
 * A color scale created from linear stops
 * @public
 */

class ColorScale {
  constructor(stops) {
    if (stops == null || stops.length === 0) {
      throw new Error("The stops argument must be non-empty");
    } else {
      this.stops = this.sortColorScaleStops(stops);
    }
  }

  static createBalancedColorScale(colors) {
    if (colors == null || colors.length === 0) {
      throw new Error("The colors argument must be non-empty");
    }

    const stops = new Array(colors.length);

    for (let i = 0; i < colors.length; i++) {
      // Special case first and last in order to avoid floating point jaggies
      if (i === 0) {
        stops[i] = {
          color: colors[i],
          position: 0
        };
      } else if (i === colors.length - 1) {
        stops[i] = {
          color: colors[i],
          position: 1
        };
      } else {
        stops[i] = {
          color: colors[i],
          position: i * (1 / (colors.length - 1))
        };
      }
    }

    return new ColorScale(stops);
  }

  getColor(position, interpolationMode = ColorInterpolationSpace.RGB) {
    if (this.stops.length === 1) {
      return this.stops[0].color;
    } else if (position <= 0) {
      return this.stops[0].color;
    } else if (position >= 1) {
      return this.stops[this.stops.length - 1].color;
    }

    let lowerIndex = 0;

    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].position <= position) {
        lowerIndex = i;
      }
    }

    let upperIndex = lowerIndex + 1;

    if (upperIndex >= this.stops.length) {
      upperIndex = this.stops.length - 1;
    }

    const scalePosition = (position - this.stops[lowerIndex].position) * (1.0 / (this.stops[upperIndex].position - this.stops[lowerIndex].position));
    return interpolateByColorSpace(scalePosition, interpolationMode, this.stops[lowerIndex].color, this.stops[upperIndex].color);
  }

  trim(lowerBound, upperBound, interpolationMode = ColorInterpolationSpace.RGB) {
    if (lowerBound < 0 || upperBound > 1 || upperBound < lowerBound) {
      throw new Error("Invalid bounds");
    }

    if (lowerBound === upperBound) {
      return new ColorScale([{
        color: this.getColor(lowerBound, interpolationMode),
        position: 0
      }]);
    }

    const containedStops = [];

    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].position >= lowerBound && this.stops[i].position <= upperBound) {
        containedStops.push(this.stops[i]);
      }
    }

    if (containedStops.length === 0) {
      return new ColorScale([{
        color: this.getColor(lowerBound),
        position: lowerBound
      }, {
        color: this.getColor(upperBound),
        position: upperBound
      }]);
    }

    if (containedStops[0].position !== lowerBound) {
      containedStops.unshift({
        color: this.getColor(lowerBound),
        position: lowerBound
      });
    }

    if (containedStops[containedStops.length - 1].position !== upperBound) {
      containedStops.push({
        color: this.getColor(upperBound),
        position: upperBound
      });
    }

    const range = upperBound - lowerBound;
    const finalStops = new Array(containedStops.length);

    for (let i = 0; i < containedStops.length; i++) {
      finalStops[i] = {
        color: containedStops[i].color,
        position: (containedStops[i].position - lowerBound) / range
      };
    }

    return new ColorScale(finalStops);
  }

  findNextColor(position, contrast, searchDown = false, interpolationMode = ColorInterpolationSpace.RGB, contrastErrorMargin = 0.005, maxSearchIterations = 32) {
    if (isNaN(position) || position <= 0) {
      position = 0;
    } else if (position >= 1) {
      position = 1;
    }

    const startingColor = this.getColor(position, interpolationMode);
    const finalPosition = searchDown ? 0 : 1;
    const finalColor = this.getColor(finalPosition, interpolationMode);
    const finalContrast = contrastRatio(startingColor, finalColor);

    if (finalContrast <= contrast) {
      return finalPosition;
    }

    let testRangeMin = searchDown ? 0 : position;
    let testRangeMax = searchDown ? position : 0;
    let mid = finalPosition;
    let iterations = 0;

    while (iterations <= maxSearchIterations) {
      mid = Math.abs(testRangeMax - testRangeMin) / 2 + testRangeMin;
      const midColor = this.getColor(mid, interpolationMode);
      const midContrast = contrastRatio(startingColor, midColor);

      if (Math.abs(midContrast - contrast) <= contrastErrorMargin) {
        return mid;
      } else if (midContrast > contrast) {
        if (searchDown) {
          testRangeMin = mid;
        } else {
          testRangeMax = mid;
        }
      } else {
        if (searchDown) {
          testRangeMax = mid;
        } else {
          testRangeMin = mid;
        }
      }

      iterations++;
    }

    return mid;
  }

  clone() {
    const newStops = new Array(this.stops.length);

    for (let i = 0; i < newStops.length; i++) {
      newStops[i] = {
        color: this.stops[i].color,
        position: this.stops[i].position
      };
    }

    return new ColorScale(newStops);
  }

  sortColorScaleStops(stops) {
    return stops.sort((a, b) => {
      const A = a.position;
      const B = b.position;

      if (A < B) {
        return -1;
      } else if (A > B) {
        return 1;
      } else {
        return 0;
      }
    });
  }

}

const webRGBRegex = /^rgb\(\s*((?:(?:25[0-5]|2[0-4]\d|1\d\d|\d{1,2})\s*,\s*){2}(?:25[0-5]|2[0-4]\d|1\d\d|\d{1,2})\s*)\)$/i; // Matches rgb(R, G, B, A) where R, G, and B are integers [0 - 255] and A is [0-1] floating

const hexRGBRegex = /^#((?:[0-9a-f]{6}|[0-9a-f]{3}))$/i; // Matches #RGB and #RRGGBBAA, where R, G, B, and A are [0-9] or [A-F]
/**
 * Test if a color matches #RRGGBB or #RGB
 * @public
 */

function isColorStringHexRGB(raw) {
  return hexRGBRegex.test(raw);
}
/**
 * Test if a color matches rgb(rr, gg, bb)
 * @public
 */

function isColorStringWebRGB(raw) {
  return webRGBRegex.test(raw);
}
/**
 * Converts a hexadecimal color string to a {@link @microsoft/fast-colors#ColorRGBA64}.
 * @param raw - a color string in the form of "#RRGGBB" or "#RGB"
 * @example
 * ```ts
 * parseColorHexRGBA("#FF0000");
 * parseColorHexRGBA("#F00");
 * ```
 * @public
 */

function parseColorHexRGB(raw) {
  const result = hexRGBRegex.exec(raw);

  if (result === null) {
    return null;
  }

  let digits = result[1];

  if (digits.length === 3) {
    const r = digits.charAt(0);
    const g = digits.charAt(1);
    const b = digits.charAt(2);
    digits = r.concat(r, g, g, b, b);
  }

  const rawInt = parseInt(digits, 16);

  if (isNaN(rawInt)) {
    return null;
  } // Note the use of >>> rather than >> as we want JS to manipulate these as unsigned numbers


  return new ColorRGBA64(normalize((rawInt & 0xff0000) >>> 16, 0, 255), normalize((rawInt & 0x00ff00) >>> 8, 0, 255), normalize(rawInt & 0x0000ff, 0, 255), 1);
}
/**
 * Converts a rgb color string to a {@link @microsoft/fast-colors#ColorRGBA64}.
 * @param raw - a color string format "rgba(RR,GG,BB)" where RR,GG,BB are [0,255]
 * @example
 * ```ts
 * parseColorWebRGB("rgba(255, 0, 0");
 * ```
 * @public
 */

function parseColorWebRGB(raw) {
  const result = webRGBRegex.exec(raw);

  if (result === null) {
    return null;
  }

  const split = result[1].split(",");
  return new ColorRGBA64(normalize(Number(split[0]), 0, 255), normalize(Number(split[1]), 0, 255), normalize(Number(split[2]), 0, 255), 1);
}

/**
 * Generates a color palette
 * @public
 */

class ColorPalette {
  constructor(config) {
    this.config = Object.assign({}, ColorPalette.defaultPaletteConfig, config);
    this.palette = [];
    this.updatePaletteColors();
  }

  updatePaletteGenerationValues(newConfig) {
    let changed = false;

    for (const key in newConfig) {
      if (this.config[key]) {
        if (this.config[key].equalValue) {
          if (!this.config[key].equalValue(newConfig[key])) {
            this.config[key] = newConfig[key];
            changed = true;
          }
        } else {
          if (newConfig[key] !== this.config[key]) {
            this.config[key] = newConfig[key];
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.updatePaletteColors();
    }

    return changed;
  }

  updatePaletteColors() {
    const scale = this.generatePaletteColorScale();

    for (let i = 0; i < this.config.steps; i++) {
      this.palette[i] = scale.getColor(i / (this.config.steps - 1), this.config.interpolationMode);
    }
  }

  generatePaletteColorScale() {
    // Even when config.baseScalePosition is specified, using 0.5 for the baseColor
    // in the baseScale gives better results. Otherwise very off-center palettes
    // tend to go completely grey at the end furthest from the specified base color.
    const baseColorHSL = rgbToHSL(this.config.baseColor);
    const baseScale = new ColorScale([{
      position: 0,
      color: this.config.scaleColorLight
    }, {
      position: 0.5,
      color: this.config.baseColor
    }, {
      position: 1,
      color: this.config.scaleColorDark
    }]);
    const trimmedScale = baseScale.trim(this.config.clipLight, 1 - this.config.clipDark);
    const trimmedLight = trimmedScale.getColor(0);
    const trimmedDark = trimmedScale.getColor(1);
    let adjustedLight = trimmedLight;
    let adjustedDark = trimmedDark;

    if (baseColorHSL.s >= this.config.saturationAdjustmentCutoff) {
      adjustedLight = saturateViaLCH(adjustedLight, this.config.saturationLight);
      adjustedDark = saturateViaLCH(adjustedDark, this.config.saturationDark);
    }

    if (this.config.multiplyLight !== 0) {
      const multiply = blendMultiply(this.config.baseColor, adjustedLight);
      adjustedLight = interpolateByColorSpace(this.config.multiplyLight, this.config.interpolationMode, adjustedLight, multiply);
    }

    if (this.config.multiplyDark !== 0) {
      const multiply = blendMultiply(this.config.baseColor, adjustedDark);
      adjustedDark = interpolateByColorSpace(this.config.multiplyDark, this.config.interpolationMode, adjustedDark, multiply);
    }

    if (this.config.overlayLight !== 0) {
      const overlay = blendOverlay(this.config.baseColor, adjustedLight);
      adjustedLight = interpolateByColorSpace(this.config.overlayLight, this.config.interpolationMode, adjustedLight, overlay);
    }

    if (this.config.overlayDark !== 0) {
      const overlay = blendOverlay(this.config.baseColor, adjustedDark);
      adjustedDark = interpolateByColorSpace(this.config.overlayDark, this.config.interpolationMode, adjustedDark, overlay);
    }

    if (this.config.baseScalePosition) {
      if (this.config.baseScalePosition <= 0) {
        return new ColorScale([{
          position: 0,
          color: this.config.baseColor
        }, {
          position: 1,
          color: adjustedDark.clamp()
        }]);
      } else if (this.config.baseScalePosition >= 1) {
        return new ColorScale([{
          position: 0,
          color: adjustedLight.clamp()
        }, {
          position: 1,
          color: this.config.baseColor
        }]);
      }

      return new ColorScale([{
        position: 0,
        color: adjustedLight.clamp()
      }, {
        position: this.config.baseScalePosition,
        color: this.config.baseColor
      }, {
        position: 1,
        color: adjustedDark.clamp()
      }]);
    }

    return new ColorScale([{
      position: 0,
      color: adjustedLight.clamp()
    }, {
      position: 0.5,
      color: this.config.baseColor
    }, {
      position: 1,
      color: adjustedDark.clamp()
    }]);
  }

}
ColorPalette.defaultPaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 11,
  interpolationMode: ColorInterpolationSpace.RGB,
  scaleColorLight: new ColorRGBA64(1, 1, 1, 1),
  scaleColorDark: new ColorRGBA64(0, 0, 0, 1),
  clipLight: 0.185,
  clipDark: 0.16,
  saturationAdjustmentCutoff: 0.05,
  saturationLight: 0.35,
  saturationDark: 1.25,
  overlayLight: 0,
  overlayDark: 0.25,
  multiplyLight: 0,
  multiplyDark: 0,
  baseScalePosition: 0.5
};
ColorPalette.greyscalePaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 11,
  interpolationMode: ColorInterpolationSpace.RGB,
  scaleColorLight: new ColorRGBA64(1, 1, 1, 1),
  scaleColorDark: new ColorRGBA64(0, 0, 0, 1),
  clipLight: 0,
  clipDark: 0,
  saturationAdjustmentCutoff: 0,
  saturationLight: 0,
  saturationDark: 0,
  overlayLight: 0,
  overlayDark: 0,
  multiplyLight: 0,
  multiplyDark: 0,
  baseScalePosition: 0.5
};
/**
 * @public
 */

const defaultCenteredRescaleConfig = {
  targetSize: 63,
  spacing: 4,
  scaleColorLight: ColorPalette.defaultPaletteConfig.scaleColorLight,
  scaleColorDark: ColorPalette.defaultPaletteConfig.scaleColorDark
};

/**
 * Creates a color palette for UI components
 * @public
 */

class ComponentStateColorPalette {
  constructor(config) {
    this.palette = [];
    this.config = Object.assign({}, ComponentStateColorPalette.defaultPaletteConfig, config);
    this.regenPalettes();
  }

  regenPalettes() {
    let steps = this.config.steps;

    if (isNaN(steps) || steps < 3) {
      steps = 3;
    } // This palette is tuned to go as dark as differences between the levels can be perceived according to tests
    // on numerous monitors in different conditions. Stay linear from white until this first cutoff.


    const darkLum = 0.14; // In the dark compression, this is the last luminance value before full black.

    const darkestLum = 0.06; // The Color for the luminance value above, placed on the ramp at it's normal position, so darker colors after
    // it can be compressed.

    const darkLumColor = new ColorRGBA64(darkLum, darkLum, darkLum, 1); // The number of steps in the ramp that has been tuned for default use. This coincides with the size of the
    // default ramp, but the palette could be generated with fewer steps to increase final contrast. This number
    // should however stay the same.

    const stepsForLuminanceRamp = 94; // Create the reference, dark-compressed, grey palette, like:
    // F------------------------------------------------------------------------------------[dark]------[darkest]0
    //                                                                                      |--compressed area--|

    const r = new ColorPalette(Object.assign(Object.assign({}, ColorPalette.greyscalePaletteConfig), {
      baseColor: darkLumColor,
      baseScalePosition: (1 - darkLum) * 100 / stepsForLuminanceRamp,
      steps
    }));
    const referencePalette = r.palette; // Find the requested base color on the adjusted luminance reference ramp.
    // There is no _right_ way to desaturate a color, and both methods we've tested have value, so average them out.

    const baseColorLum1 = rgbToLinearLuminance(this.config.baseColor);
    const baseColorLum2 = rgbToHSL(this.config.baseColor).l;
    const baseColorLum = (baseColorLum1 + baseColorLum2) / 2;
    const baseColorRefIndex = this.matchRelativeLuminanceIndex(baseColorLum, referencePalette);
    const baseColorPercent = baseColorRefIndex / (steps - 1); // Find the luminance location for the dark cutoff.

    const darkRefIndex = this.matchRelativeLuminanceIndex(darkLum, referencePalette);
    const darkPercent = darkRefIndex / (steps - 1); // Issue https://github.com/microsoft/fast/issues/1904
    // Creating a color from H, S, and a known L value is not the inverse of getting the relative
    // luminace as above. Need to derive a relative luminance version of the color to better match on the dark end.
    // Find the dark cutoff and darkest variations of the requested base color.

    const baseColorHSL = rgbToHSL(this.config.baseColor);
    const darkBaseColor = hslToRGB(ColorHSL.fromObject({
      h: baseColorHSL.h,
      s: baseColorHSL.s,
      l: darkLum
    }));
    const darkestBaseColor = hslToRGB(ColorHSL.fromObject({
      h: baseColorHSL.h,
      s: baseColorHSL.s,
      l: darkestLum
    })); // Create the gradient stops, including the base color and anchor colors for the dark end compression.

    const fullColorScaleStops = new Array(5);
    fullColorScaleStops[0] = {
      position: 0,
      color: new ColorRGBA64(1, 1, 1, 1)
    };
    fullColorScaleStops[1] = {
      position: baseColorPercent,
      color: this.config.baseColor
    };
    fullColorScaleStops[2] = {
      position: darkPercent,
      color: darkBaseColor
    };
    fullColorScaleStops[3] = {
      position: 0.99,
      color: darkestBaseColor
    };
    fullColorScaleStops[4] = {
      position: 1,
      color: new ColorRGBA64(0, 0, 0, 1)
    };
    const scale = new ColorScale(fullColorScaleStops); // Create the palette.

    this.palette = new Array(steps);

    for (let i = 0; i < steps; i++) {
      const c = scale.getColor(i / (steps - 1), ColorInterpolationSpace.RGB);
      this.palette[i] = c;
    }
  }

  matchRelativeLuminanceIndex(input, reference) {
    let bestFitValue = Number.MAX_VALUE;
    let bestFitIndex = 0;
    let i = 0;
    const referenceLength = reference.length;

    for (; i < referenceLength; i++) {
      const fitValue = Math.abs(rgbToLinearLuminance(reference[i]) - input);

      if (fitValue < bestFitValue) {
        bestFitValue = fitValue;
        bestFitIndex = i;
      }
    }

    return bestFitIndex;
  }

}
ComponentStateColorPalette.defaultPaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 94
};

const white = "#FFFFFF";
const black = "#000000";
/**
 * @deprecated
 */

const paletteConstants = {
  steps: 94,
  clipLight: 0,
  clipDark: 0
};
/**
 * @deprecated
 */

const neutralPaletteConfig = Object.assign({}, paletteConstants);
/**
 * @deprecated
 */

const accentPaletteConfig = Object.assign(Object.assign({}, paletteConstants), {
  baseColor: parseColorHexRGB("#0078D4")
});

/**
 * DO NOT EDIT THIS FILE DIRECTLY
 * This file generated by fast-components-styles-msft/generate-palettes.js
 */
const neutralPalette = ["#FFFFFF", "#FCFCFC", "#FAFAFA", "#F7F7F7", "#F5F5F5", "#F2F2F2", "#EFEFEF", "#EDEDED", "#EAEAEA", "#E8E8E8", "#E5E5E5", "#E2E2E2", "#E0E0E0", "#DDDDDD", "#DBDBDB", "#D8D8D8", "#D6D6D6", "#D3D3D3", "#D0D0D0", "#CECECE", "#CBCBCB", "#C9C9C9", "#C6C6C6", "#C3C3C3", "#C1C1C1", "#BEBEBE", "#BCBCBC", "#B9B9B9", "#B6B6B6", "#B4B4B4", "#B1B1B1", "#AFAFAF", "#ACACAC", "#A9A9A9", "#A7A7A7", "#A4A4A4", "#A2A2A2", "#9F9F9F", "#9D9D9D", "#9A9A9A", "#979797", "#959595", "#929292", "#909090", "#8D8D8D", "#8A8A8A", "#888888", "#858585", "#838383", "#808080", "#7D7D7D", "#7B7B7B", "#787878", "#767676", "#737373", "#717171", "#6E6E6E", "#6B6B6B", "#696969", "#666666", "#646464", "#616161", "#5F5F5F", "#5C5C5C", "#5A5A5A", "#575757", "#545454", "#525252", "#4F4F4F", "#4D4D4D", "#4A4A4A", "#484848", "#454545", "#424242", "#404040", "#3D3D3D", "#3B3B3B", "#383838", "#363636", "#333333", "#313131", "#2E2E2E", "#2B2B2B", "#292929", "#262626", "#242424", "#212121", "#1E1E1E", "#1B1B1B", "#181818", "#151515", "#121212", "#101010", "#000000"];
const accentPalette = ["#FFFFFF", "#FBFDFE", "#F6FAFE", "#F2F8FD", "#EEF6FC", "#E9F4FB", "#E5F1FB", "#E1EFFA", "#DCEDF9", "#D8EAF8", "#D4E8F8", "#CFE6F7", "#CBE4F6", "#C7E1F6", "#C2DFF5", "#BEDDF4", "#BADAF3", "#B6D8F3", "#B1D6F2", "#ADD4F1", "#A9D1F0", "#A4CFF0", "#A0CDEF", "#9CCAEE", "#97C8EE", "#93C6ED", "#8FC4EC", "#8AC1EB", "#86BFEB", "#82BDEA", "#7DBAE9", "#79B8E8", "#75B6E8", "#70B3E7", "#6CB1E6", "#68AFE5", "#63ADE5", "#5FAAE4", "#5BA8E3", "#56A6E3", "#52A3E2", "#4EA1E1", "#499FE0", "#459DE0", "#419ADF", "#3D98DE", "#3896DD", "#3493DD", "#3091DC", "#2B8FDB", "#278DDB", "#238ADA", "#1E88D9", "#1A86D8", "#1683D8", "#1181D7", "#0D7FD6", "#097DD5", "#047AD5", "#0078D4", "#0075CF", "#0072C9", "#006FC4", "#006CBE", "#0069B9", "#0066B4", "#0063AE", "#0060A9", "#005CA3", "#00599E", "#005699", "#005393", "#00508E", "#004D88", "#004A83", "#00477D", "#004478", "#004173", "#003E6D", "#003B68", "#003862", "#00355D", "#003258", "#002F52", "#002B4D", "#002847", "#002542", "#00223C", "#001F36", "#001B30", "#00182B", "#001525", "#00121F", "#000000"];

const defaultFontWeights = {
  light: 100,
  semilight: 200,
  normal: 400,
  semibold: 600,
  bold: 700
};
const designSystemDefaults = {
  backgroundColor: white,
  contrast: 0,
  density: 0,
  designUnit: 4,
  baseHeightMultiplier: 8,
  baseHorizontalSpacingMultiplier: 3,
  direction: Direction.ltr,
  cornerRadius: 2,
  elevatedCornerRadius: 4,
  focusOutlineWidth: 2,
  fontWeight: defaultFontWeights,
  disabledOpacity: 0.3,
  outlineWidth: 1,
  neutralPalette,
  accentPalette,
  accentBaseColor: "#0078D4",

  /**
   * Recipe Deltas
   */
  accentFillRestDelta: 0,
  accentFillHoverDelta: 4,
  accentFillActiveDelta: -5,
  accentFillFocusDelta: 0,
  accentFillSelectedDelta: 12,
  accentForegroundRestDelta: 0,
  accentForegroundHoverDelta: 6,
  accentForegroundActiveDelta: -4,
  accentForegroundFocusDelta: 0,
  neutralFillRestDelta: 7,
  neutralFillHoverDelta: 10,
  neutralFillActiveDelta: 5,
  neutralFillFocusDelta: 0,
  neutralFillSelectedDelta: 7,
  neutralFillInputRestDelta: 0,
  neutralFillInputHoverDelta: 0,
  neutralFillInputActiveDelta: 0,
  neutralFillInputFocusDelta: 0,
  neutralFillInputSelectedDelta: 0,
  neutralFillStealthRestDelta: 0,
  neutralFillStealthHoverDelta: 5,
  neutralFillStealthActiveDelta: 3,
  neutralFillStealthFocusDelta: 0,
  neutralFillStealthSelectedDelta: 7,
  neutralFillToggleHoverDelta: 8,
  neutralFillToggleActiveDelta: -5,
  neutralFillToggleFocusDelta: 0,
  baseLayerLuminance: -1,
  neutralFillCardDelta: 3,
  neutralForegroundDarkIndex: 93,
  neutralForegroundLightIndex: 0,
  neutralForegroundHoverDelta: 0,
  neutralForegroundActiveDelta: 0,
  neutralForegroundFocusDelta: 0,
  neutralDividerRestDelta: 8,
  neutralOutlineRestDelta: 25,
  neutralOutlineHoverDelta: 40,
  neutralOutlineActiveDelta: 16,
  neutralOutlineFocusDelta: 25
};
/**
 * Returns the argument if basic, otherwise calls the DesignSystemResolver function.
 *
 * @param arg A value or a DesignSystemResolver function
 * @param designSystem The design system config.
 */

function checkDesignSystemResolver(arg, designSystem) {
  return isFunction(arg) ? arg(designSystem) : arg;
}

/**
 * Safely retrieves the value from a key of the DesignSystem.
 */

function getDesignSystemValue(key) {
  return designSystem => {
    return designSystem && designSystem[key] !== undefined ? designSystem[key] : designSystemDefaults[key];
  };
}
/**
 * Retrieve the backgroundColor when invoked with a DesignSystem
 */

const backgroundColor = getDesignSystemValue("backgroundColor");
/**
 * Retrieve the accentBaseColor when invoked with a DesignSystem
 */

const accentBaseColor = getDesignSystemValue("accentBaseColor");
/**
 * Retrieve the neutral palette from the design system
 */

const neutralPalette$1 = getDesignSystemValue("neutralPalette");
/**
 * Retrieve the accent palette from the design system
 */

const accentPalette$1 = getDesignSystemValue("accentPalette");
/**
 * Retrieve the direction from the design system
 */

const direction = getDesignSystemValue("direction");
const accentFillHoverDelta = getDesignSystemValue("accentFillHoverDelta");
const accentFillActiveDelta = getDesignSystemValue("accentFillActiveDelta");
const accentFillFocusDelta = getDesignSystemValue("accentFillFocusDelta");
const accentFillSelectedDelta = getDesignSystemValue("accentFillSelectedDelta");
const accentForegroundRestDelta = getDesignSystemValue("accentForegroundRestDelta");
const accentForegroundHoverDelta = getDesignSystemValue("accentForegroundHoverDelta");
const accentForegroundActiveDelta = getDesignSystemValue("accentForegroundActiveDelta");
const accentForegroundFocusDelta = getDesignSystemValue("accentForegroundFocusDelta");
const neutralFillRestDelta = getDesignSystemValue("neutralFillRestDelta");
const neutralFillHoverDelta = getDesignSystemValue("neutralFillHoverDelta");
const neutralFillActiveDelta = getDesignSystemValue("neutralFillActiveDelta");
const neutralFillFocusDelta = getDesignSystemValue("neutralFillFocusDelta");
const neutralFillSelectedDelta = getDesignSystemValue("neutralFillSelectedDelta");
const neutralFillInputRestDelta = getDesignSystemValue("neutralFillInputRestDelta");
const neutralFillInputHoverDelta = getDesignSystemValue("neutralFillInputHoverDelta");
const neutralFillInputActiveDelta = getDesignSystemValue("neutralFillInputActiveDelta");
const neutralFillInputFocusDelta = getDesignSystemValue("neutralFillInputFocusDelta");
const neutralFillInputSelectedDelta = getDesignSystemValue("neutralFillInputSelectedDelta");
const neutralFillStealthRestDelta = getDesignSystemValue("neutralFillStealthRestDelta");
const neutralFillStealthHoverDelta = getDesignSystemValue("neutralFillStealthHoverDelta");
const neutralFillStealthActiveDelta = getDesignSystemValue("neutralFillStealthActiveDelta");
const neutralFillStealthFocusDelta = getDesignSystemValue("neutralFillStealthFocusDelta");
const neutralFillStealthSelectedDelta = getDesignSystemValue("neutralFillStealthSelectedDelta");
const neutralFillToggleHoverDelta = getDesignSystemValue("neutralFillToggleHoverDelta");
const neutralFillToggleActiveDelta = getDesignSystemValue("neutralFillToggleActiveDelta");
const neutralFillToggleFocusDelta = getDesignSystemValue("neutralFillToggleFocusDelta");
const baseLayerLuminance = getDesignSystemValue("baseLayerLuminance");
const neutralFillCardDelta = getDesignSystemValue("neutralFillCardDelta");
const neutralForegroundHoverDelta = getDesignSystemValue("neutralForegroundHoverDelta");
const neutralForegroundActiveDelta = getDesignSystemValue("neutralForegroundActiveDelta");
const neutralForegroundFocusDelta = getDesignSystemValue("neutralForegroundFocusDelta");
const neutralDividerRestDelta = getDesignSystemValue("neutralDividerRestDelta");
const neutralOutlineRestDelta = getDesignSystemValue("neutralOutlineRestDelta");
const neutralOutlineHoverDelta = getDesignSystemValue("neutralOutlineHoverDelta");
const neutralOutlineActiveDelta = getDesignSystemValue("neutralOutlineActiveDelta");
const neutralOutlineFocusDelta = getDesignSystemValue("neutralOutlineFocusDelta");

/**
 * The states that a swatch can have
 */

var SwatchFamilyType;

(function (SwatchFamilyType) {
  SwatchFamilyType["rest"] = "rest";
  SwatchFamilyType["hover"] = "hover";
  SwatchFamilyType["active"] = "active";
  SwatchFamilyType["focus"] = "focus";
  SwatchFamilyType["selected"] = "selected";
})(SwatchFamilyType || (SwatchFamilyType = {}));

function colorRecipeFactory(recipe) {
  const memoizedRecipe = memoize(recipe);

  function curryRecipe(arg) {
    if (typeof arg === "function") {
      return designSystem => {
        return memoizedRecipe(Object.assign({}, designSystem, {
          backgroundColor: arg(designSystem)
        }));
      };
    } else {
      return memoizedRecipe(arg);
    }
  }

  return curryRecipe;
}
/**
 * Helper function to transform a SwatchFamilyResolver into simple ColorRecipe for simple use
 * use in stylesheets.
 */

function swatchFamilyToSwatchRecipeFactory(type, callback) {
  const memoizedRecipe = memoize(callback);
  return arg => {
    if (typeof arg === "function") {
      return designSystem => {
        return memoizedRecipe(Object.assign({}, designSystem, {
          backgroundColor: arg(designSystem)
        }))[type];
      };
    } else {
      return memoizedRecipe(arg)[type];
    }
  };
}
/**
 * Converts a color string into a ColorRGBA64 instance.
 * Supports #RRGGBB and rgb(r, g, b) formats
 */

const parseColorString = memoize(color => {
  let parsed = parseColorHexRGB(color);

  if (parsed !== null) {
    return parsed;
  }

  parsed = parseColorWebRGB(color);

  if (parsed !== null) {
    return parsed;
  }

  throw new Error(`${color} cannot be converted to a ColorRGBA64. Color strings must be one of the following formats: "#RGB", "#RRGGBB", or "rgb(r, g, b)"`);
});
/**
 * Determines if a string value represents a color
 * Supports #RRGGBB and rgb(r, g, b) formats
 */

function isValidColor(color) {
  return isColorStringHexRGB(color) || isColorStringWebRGB(color);
}
/**
 * Determines if a color string matches another color.
 * Supports #RRGGBB and rgb(r, g, b) formats
 */

function colorMatches(a, b) {
  return parseColorString(a).equalValue(parseColorString(b));
}
/**
 * Returns the contrast value between two color strings.
 * Supports #RRGGBB and rgb(r, g, b) formats.
 */

const contrast = memoize((a, b) => {
  return contrastRatio(parseColorString(a), parseColorString(b));
}, (a, b) => a + b);
/**
 * Returns the relative luminance of a color. If the value is not a color, -1 will be returned
 * Supports #RRGGBB and rgb(r, g, b) formats
 */

function luminance(color) {
  return rgbToRelativeLuminance(parseColorString(color));
}
function designSystemResolverMax(...args) {
  return designSystem => Math.max.apply(null, args.map(fn => fn(designSystem)));
}
const clamp$1 = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * The named palettes of the MSFT design system
 * @deprecated - use neutralPalette and accentPalette functions instead
 */

var PaletteType;

(function (PaletteType) {
  PaletteType["neutral"] = "neutral";
  PaletteType["accent"] = "accent";
})(PaletteType || (PaletteType = {}));
/**
 * A function to find the index of a swatch in a specified palette. If the color is found,
 * otherwise it will return -1
 */

function findSwatchIndex(paletteResolver, swatch) {
  return designSystem => {
    if (!isValidColor(swatch)) {
      return -1;
    }

    const colorPalette = checkDesignSystemResolver(paletteResolver, designSystem);
    const index = colorPalette.indexOf(swatch); // If we don't find the string exactly, it might be because of color formatting differences

    return index !== -1 ? index : colorPalette.findIndex(paletteSwatch => {
      return isValidColor(paletteSwatch) && colorMatches(swatch, paletteSwatch);
    });
  };
}
/**
 * Returns the closest swatch in a palette to an input swatch.
 * If the input swatch cannot be converted to a color, 0 will be returned
 */

function findClosestSwatchIndex(paletteResolver, swatch) {
  return designSystem => {
    const resolvedPalette = checkDesignSystemResolver(paletteResolver, designSystem);
    const resolvedSwatch = checkDesignSystemResolver(swatch, designSystem);
    const index = findSwatchIndex(resolvedPalette, resolvedSwatch)(designSystem);
    let swatchLuminance;

    if (index !== -1) {
      return index;
    }

    try {
      swatchLuminance = luminance(resolvedSwatch);
    } catch (e) {
      swatchLuminance = -1;
    }

    if (swatchLuminance === -1) {
      return 0;
    }

    return resolvedPalette.map((mappedSwatch, mappedIndex) => {
      return {
        luminance: luminance(mappedSwatch),
        index: mappedIndex
      };
    }).reduce((previousValue, currentValue) => {
      return Math.abs(currentValue.luminance - swatchLuminance) < Math.abs(previousValue.luminance - swatchLuminance) ? currentValue : previousValue;
    }).index;
  };
}
/**
 * Determines if the design-system should be considered in "dark mode".
 * We're in dark mode if we have more contrast between #000000 and our background
 * color than #FFFFFF and our background color. That threshold can be expressed as a relative luminance
 * using the contrast formula as (1 + 0.5) / (bg + 0.05) === (bg + 0.05) / (0 + 0.05),
 * which reduces to the following, where bg is the relative luminance of the background color
 */

function isDarkMode(designSystem) {
  return luminance(backgroundColor(designSystem)) <= (-0.1 + Math.sqrt(0.21)) / 2;
}
function getSwatch(index, colorPalette) {
  if (typeof index === "function") {
    return designSystem => {
      return colorPalette(designSystem)[clamp$1(index(designSystem), 0, colorPalette(designSystem).length - 1)];
    };
  } else {
    return colorPalette[clamp$1(index, 0, colorPalette.length - 1)];
  }
}
function swatchByMode(paletteResolver) {
  return (valueA, valueB) => {
    return designSystem => {
      return getSwatch(isDarkMode(designSystem) ? checkDesignSystemResolver(valueB, designSystem) : checkDesignSystemResolver(valueA, designSystem), paletteResolver(designSystem));
    };
  };
}

function binarySearch(valuesToSearch, searchCondition, startIndex = 0, endIndex = valuesToSearch.length - 1) {
  if (endIndex === startIndex) {
    return valuesToSearch[startIndex];
  }

  const middleIndex = Math.floor((endIndex - startIndex) / 2) + startIndex; // Check to see if this passes on the item in the center of the array
  // if it does check the previous values

  if (searchCondition(valuesToSearch[middleIndex])) {
    return binarySearch(valuesToSearch, searchCondition, startIndex, middleIndex // include this index because it passed the search condition
    );
  } else {
    return binarySearch(valuesToSearch, searchCondition, middleIndex + 1, // exclude this index because it failed the search condition
    endIndex);
  }
} // disable type-defs because this a deeply curried function and the call-signature is pretty complicated
// and typescript can work it out automatically for consumers

/**
 * Retrieves a swatch from an input palette, where the swatch's contrast against the reference color
 * passes an input condition. The direction to search in the palette is determined by an input condition.
 * Where to begin the search in the palette will be determined another input function that should return the starting index.
 * example: swatchByContrast(
 *              "#FFF" // compare swatches against "#FFF"
 *          )(
 *              neutralPalette // use the neutral palette from the DesignSystem - since this is a function, it will be evaluated with the DesignSystem
 *          )(
 *              () => 0 // begin searching for a swatch at the beginning of the neutral palette
 *          )(
 *              () => 1 // While searching, search in the direction toward the end of the array (-1 moves towards the beginning of the array)
 *          )(
 *              minContrastTargetFactory(4.5) // A swatch is only valid if the contrast is greater than 4.5
 *          )(
 *              designSystem // Pass the design-system. The first swatch that passes the previous condition will be returned from this function
 *          )
 */


function swatchByContrast(referenceColor) {
  /**
   * A function that expects a function that resolves a palette
   */
  return paletteResolver => {
    /**
     * A function that expects a function that resolves the index
     * of the palette that the algorithm should begin looking for a swatch at
     */
    return indexResolver => {
      /**
       * A function that expects a function that determines which direction in the
       * palette we should look for a swatch relative to the initial index
       */
      return directionResolver => {
        /**
         * A function that expects a function that determines if the contrast
         * between the reference color and color from the palette are acceptable
         */
        return contrastCondition => {
          /**
           * A function that accepts a design-system. It resolves all of the curried arguments
           * and loops over the palette until we reach the bounds of the palette or the condition
           * is satisfied. Once either the condition is satisfied or we reach the end of the palette,
           * we return the color
           */
          return designSystem => {
            const color = checkDesignSystemResolver(referenceColor, designSystem);
            const sourcePalette = checkDesignSystemResolver(paletteResolver, designSystem);
            const length = sourcePalette.length;
            const initialSearchIndex = clamp$1(indexResolver(color, sourcePalette, designSystem), 0, length - 1);
            const direction = directionResolver(initialSearchIndex, sourcePalette, designSystem);

            function contrastSearchCondition(valueToCheckAgainst) {
              return contrastCondition(contrast(color, valueToCheckAgainst));
            }

            const constrainedSourcePalette = [].concat(sourcePalette);
            const endSearchIndex = length - 1;
            let startSearchIndex = initialSearchIndex;

            if (direction === -1) {
              // reverse the palette array when the direction that
              // the contrast resolves for is reversed
              constrainedSourcePalette.reverse();
              startSearchIndex = endSearchIndex - startSearchIndex;
            }

            return binarySearch(constrainedSourcePalette, contrastSearchCondition, startSearchIndex, endSearchIndex);
          };
        };
      };
    };
  };
}
/**
 * Resolves the index that the contrast search algorithm should start at
 */

function referenceColorInitialIndexResolver(referenceColor, sourcePalette, designSystem) {
  return findClosestSwatchIndex(sourcePalette, referenceColor)(designSystem);
}
function findClosestBackgroundIndex(designSystem) {
  return findClosestSwatchIndex(neutralPalette$1, backgroundColor(designSystem))(designSystem);
}
function minContrastTargetFactory(targetContrast) {
  return instanceContrast => instanceContrast >= targetContrast;
}

function indexToSwatchFamily(accessibleIndex, palette, direction, restDelta, hoverDelta, activeDelta, focusDelta) {
  // One of the indexes will be rest, the other will be hover. Depends on the offsets and the direction.
  const accessibleIndex2 = accessibleIndex + direction * Math.abs(restDelta - hoverDelta);
  const indexOneIsRestState = direction === 1 ? restDelta < hoverDelta : direction * restDelta > direction * hoverDelta;
  const restIndex = indexOneIsRestState ? accessibleIndex : accessibleIndex2;
  const hoverIndex = indexOneIsRestState ? accessibleIndex2 : accessibleIndex;
  const activeIndex = restIndex + direction * activeDelta;
  const focusIndex = restIndex + direction * focusDelta;
  return {
    rest: getSwatch(restIndex, palette),
    hover: getSwatch(hoverIndex, palette),
    active: getSwatch(activeIndex, palette),
    focus: getSwatch(focusIndex, palette)
  };
}
/**
 * Function to derive accessible colors from contrast and delta configuration.
 * Performs a simple contrast check against the colors and returns
 * the color that has the most contrast against the background. If contrast
 * cannot be retrieved correctly, function returns black.
 */


function accessibleAlgorithm(palette, minContrast, restDelta, hoverDelta, activeDelta, focusDelta) {
  return designSystem => {
    const resolvedPalette = checkDesignSystemResolver(palette, designSystem);
    const direction = isDarkMode(designSystem) ? -1 : 1;
    const accessibleSwatch = swatchByContrast(backgroundColor // Compare swatches against the background
    )(resolvedPalette // Use the provided palette
    )(referenceColorInitialIndexResolver // Begin searching from the background color
    )(() => direction // Search direction based on light/dark mode
    )(minContrastTargetFactory(checkDesignSystemResolver(minContrast, designSystem)) // A swatch is only valid if the contrast is greater than indicated
    )(designSystem // Pass the design system
    );
    const accessibleIndex = findSwatchIndex(palette, accessibleSwatch)(designSystem);
    const resolvedRest = checkDesignSystemResolver(restDelta, designSystem);
    const resolvedHover = checkDesignSystemResolver(hoverDelta, designSystem);
    const resolvedActive = checkDesignSystemResolver(activeDelta, designSystem);
    const resolvedFocus = checkDesignSystemResolver(focusDelta, designSystem);
    return indexToSwatchFamily(accessibleIndex, resolvedPalette, direction, resolvedRest, resolvedHover, resolvedActive, resolvedFocus);
  };
}

const neutralForeground = colorRecipeFactory(accessibleAlgorithm(neutralPalette$1, 14, 0, neutralForegroundHoverDelta, neutralForegroundActiveDelta, neutralForegroundFocusDelta));
const neutralForegroundRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, neutralForeground);
const neutralForegroundHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, neutralForeground);
const neutralForegroundActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, neutralForeground);
const neutralForegroundFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, neutralForeground);

const neutralFillToggle = colorRecipeFactory(accessibleAlgorithm(neutralPalette$1, 4.5, 0, neutralFillToggleHoverDelta, neutralFillToggleActiveDelta, neutralFillToggleFocusDelta));
const neutralFillToggleRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, neutralFillToggle);
const neutralFillToggleHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, neutralFillToggle);
const neutralFillToggleActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, neutralFillToggle);
const neutralFillToggleFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, neutralFillToggle);

/**
 * Function to derive neutralForegroundToggle from an input background and target contrast ratio
 */

const neutralForegroundToggleAlgorithm = (backgroundColor, targetContrast) => {
  return contrast(white, backgroundColor) >= targetContrast ? white : black;
};
/**
 * Factory to create a neutral-foreground-toggle function that operates on a target contrast ratio
 */


function neutralForegroundToggleFactory(targetContrast) {
  function neutralForegroundToggleInternal(arg) {
    return typeof arg === "function" ? designSystem => {
      return neutralForegroundToggleAlgorithm(arg(designSystem), targetContrast);
    } : neutralForegroundToggleAlgorithm(neutralFillToggleRest(arg), targetContrast);
  }

  return neutralForegroundToggleInternal;
}
/**
 * Toggle text for normal sized text, less than 18pt normal weight
 */


const neutralForegroundToggle = neutralForegroundToggleFactory(4.5);
/**
 * Toggle text for large sized text, greater than 18pt or 16pt and bold
 */

const neutralForegroundToggleLarge = neutralForegroundToggleFactory(3);

/**
 * Function to derive accentForegroundCut from an input background and target contrast ratio
 */

const accentForegroundCutAlgorithm = (backgroundColor, targetContrast) => {
  return contrast(white, backgroundColor) >= targetContrast ? white : black;
};
/**
 * Factory to create a accent-foreground-cut function that operates on a target contrast ratio
 */


function accentForegroundCutFactory(targetContrast) {
  function accentForegroundCutInternal(arg) {
    return typeof arg === "function" ? designSystem => {
      return accentForegroundCutAlgorithm(arg(designSystem), targetContrast);
    } : accentForegroundCutAlgorithm(accentBaseColor(arg), targetContrast);
  }

  return accentForegroundCutInternal;
}
/**
 * Cut text for normal sized text, less than 18pt normal weight
 */


const accentForegroundCut = accentForegroundCutFactory(4.5);

function neutralForegroundHintAlgorithm(targetContrast) {
  return accessibleAlgorithm(neutralPalette$1, targetContrast, 0, 0, 0, 0);
}
/**
 * Hint text for normal sized text, less than 18pt normal weight
 */


const neutralForegroundHint = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, colorRecipeFactory(neutralForegroundHintAlgorithm(4.5)));
/**
 * Hint text for large sized text, greater than 18pt or 16pt and bold
 */

const neutralForegroundHintLarge = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, colorRecipeFactory(neutralForegroundHintAlgorithm(3)));

function accentForegroundAlgorithm(contrastTarget) {
  return designSystem => {
    const palette = accentPalette$1(designSystem);
    const accent = accentBaseColor(designSystem);
    const accentIndex = findClosestSwatchIndex(accentPalette$1, accent)(designSystem);
    const stateDeltas = {
      rest: accentForegroundRestDelta(designSystem),
      hover: accentForegroundHoverDelta(designSystem),
      active: accentForegroundActiveDelta(designSystem),
      focus: accentForegroundFocusDelta(designSystem)
    };
    const direction = isDarkMode(designSystem) ? -1 : 1;
    const startIndex = accentIndex + (direction === 1 ? Math.min(stateDeltas.rest, stateDeltas.hover) : Math.max(direction * stateDeltas.rest, direction * stateDeltas.hover));
    const accessibleSwatch = swatchByContrast(backgroundColor // Compare swatches against the background
    )(accentPalette$1 // Use the accent palette
    )(() => startIndex // Begin searching based on accent index, direction, and deltas
    )(() => direction // Search direction based on light/dark mode
    )(swatchContrast => swatchContrast >= contrastTarget // A swatch is only valid if the contrast is greater than indicated
    )(designSystem // Pass the design system
    ); // One of these will be rest, the other will be hover. Depends on the offsets and the direction.

    const accessibleIndex1 = findSwatchIndex(accentPalette$1, accessibleSwatch)(designSystem);
    const accessibleIndex2 = accessibleIndex1 + direction * Math.abs(stateDeltas.rest - stateDeltas.hover);
    const indexOneIsRestState = direction === 1 ? stateDeltas.rest < stateDeltas.hover : direction * stateDeltas.rest > direction * stateDeltas.hover;
    const restIndex = indexOneIsRestState ? accessibleIndex1 : accessibleIndex2;
    const hoverIndex = indexOneIsRestState ? accessibleIndex2 : accessibleIndex1;
    const activeIndex = restIndex + direction * stateDeltas.active;
    const focusIndex = restIndex + direction * stateDeltas.focus;
    return {
      rest: getSwatch(restIndex, palette),
      hover: getSwatch(hoverIndex, palette),
      active: getSwatch(activeIndex, palette),
      focus: getSwatch(focusIndex, palette)
    };
  };
}

const accentForeground = colorRecipeFactory(accentForegroundAlgorithm(4.5));
const accentForegroundLarge = colorRecipeFactory(accentForegroundAlgorithm(3));
const accentForegroundRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, accentForeground);
const accentForegroundHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, accentForeground);
const accentForegroundActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, accentForeground);
const accentForegroundFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, accentForeground);
const accentForegroundLargeRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, accentForegroundLarge);
const accentForegroundLargeHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, accentForegroundLarge);
const accentForegroundLargeActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, accentForegroundLarge);
const accentForegroundLargeFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, accentForegroundLarge);

const neutralFillThreshold = designSystemResolverMax(neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta, neutralFillFocusDelta);

function neutralFillAlgorithm(deltaResolver) {
  return designSystem => {
    const backgroundIndex = findClosestBackgroundIndex(designSystem);
    const swapThreshold = neutralFillThreshold(designSystem);
    const direction = backgroundIndex >= swapThreshold ? -1 : 1;
    return getSwatch(backgroundIndex + direction * deltaResolver(designSystem), neutralPalette$1(designSystem));
  };
}

const neutralFillRest = colorRecipeFactory(neutralFillAlgorithm(neutralFillRestDelta));
const neutralFillHover = colorRecipeFactory(neutralFillAlgorithm(neutralFillHoverDelta));
const neutralFillActive = colorRecipeFactory(neutralFillAlgorithm(neutralFillActiveDelta));
const neutralFillFocus = colorRecipeFactory(neutralFillAlgorithm(neutralFillFocusDelta));
const neutralFillSelected = colorRecipeFactory(neutralFillAlgorithm(neutralFillSelectedDelta));
const neutralFill = colorRecipeFactory(designSystem => {
  return {
    rest: neutralFillRest(designSystem),
    hover: neutralFillHover(designSystem),
    active: neutralFillActive(designSystem),
    focus: neutralFillFocus(designSystem),
    selected: neutralFillSelected(designSystem)
  };
});

const neutralFillStealthSwapThreshold = designSystemResolverMax(neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta, neutralFillFocusDelta, neutralFillStealthRestDelta, neutralFillStealthHoverDelta, neutralFillStealthActiveDelta, neutralFillStealthFocusDelta);

function neutralFillStealthAlgorithm(deltaResolver) {
  return designSystem => {
    const backgroundIndex = findClosestBackgroundIndex(designSystem);
    const swapThreshold = neutralFillStealthSwapThreshold(designSystem);
    const direction = backgroundIndex >= swapThreshold ? -1 : 1;
    return getSwatch(backgroundIndex + direction * deltaResolver(designSystem), neutralPalette$1(designSystem));
  };
}

const neutralFillStealthRest = colorRecipeFactory(neutralFillStealthAlgorithm(neutralFillStealthRestDelta));
const neutralFillStealthHover = colorRecipeFactory(neutralFillStealthAlgorithm(neutralFillStealthHoverDelta));
const neutralFillStealthActive = colorRecipeFactory(neutralFillStealthAlgorithm(neutralFillStealthActiveDelta));
const neutralFillStealthFocus = colorRecipeFactory(neutralFillStealthAlgorithm(neutralFillStealthFocusDelta));
const neutralFillStealthSelected = colorRecipeFactory(neutralFillStealthAlgorithm(neutralFillStealthSelectedDelta));
const neutralFillStealth = colorRecipeFactory(designSystem => {
  return {
    rest: neutralFillStealthRest(designSystem),
    hover: neutralFillStealthHover(designSystem),
    active: neutralFillStealthActive(designSystem),
    focus: neutralFillStealthFocus(designSystem),
    selected: neutralFillStealthSelected(designSystem)
  };
});

/**
 * Algorithm for determining neutral backplate colors
 */

function neutralFillInputAlgorithm(indexResolver) {
  return designSystem => {
    const direction = isDarkMode(designSystem) ? -1 : 1;
    return getSwatch(findClosestBackgroundIndex(designSystem) - indexResolver(designSystem) * direction, neutralPalette$1(designSystem));
  };
}

const neutralFillInputRest = colorRecipeFactory(neutralFillInputAlgorithm(neutralFillInputRestDelta));
const neutralFillInputHover = colorRecipeFactory(neutralFillInputAlgorithm(neutralFillInputHoverDelta));
const neutralFillInputActive = colorRecipeFactory(neutralFillInputAlgorithm(neutralFillInputActiveDelta));
const neutralFillInputFocus = colorRecipeFactory(neutralFillInputAlgorithm(neutralFillInputFocusDelta));
const neutralFillInputSelected = colorRecipeFactory(neutralFillInputAlgorithm(neutralFillInputSelectedDelta));
const neutralFillInput = colorRecipeFactory(designSystem => {
  return {
    rest: neutralFillInputRest(designSystem),
    hover: neutralFillInputHover(designSystem),
    active: neutralFillInputActive(designSystem),
    focus: neutralFillInputFocus(designSystem),
    selected: neutralFillInputSelected(designSystem)
  };
});

const neutralFillThreshold$1 = designSystemResolverMax(neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta);

function accentFillAlgorithm(contrastTarget) {
  return designSystem => {
    const palette = accentPalette$1(designSystem);
    const paletteLength = palette.length;
    const accent = accentBaseColor(designSystem);
    const textColor = accentForegroundCut(Object.assign({}, designSystem, {
      backgroundColor: accent
    }));
    const hoverDelta = accentFillHoverDelta(designSystem); // Use the hover direction that matches the neutral fill recipe.

    const backgroundIndex = findClosestBackgroundIndex(designSystem);
    const swapThreshold = neutralFillThreshold$1(designSystem);
    const direction = backgroundIndex >= swapThreshold ? -1 : 1;
    const maxIndex = paletteLength - 1;
    const accentIndex = findClosestSwatchIndex(accentPalette$1, accent)(designSystem);
    let accessibleOffset = 0; // Move the accent color the direction of hover, while maintaining the foreground color.

    while (accessibleOffset < direction * hoverDelta && inRange(accentIndex + accessibleOffset + direction, 0, paletteLength) && contrast(palette[accentIndex + accessibleOffset + direction], textColor) >= contrastTarget && inRange(accentIndex + accessibleOffset + direction + direction, 0, maxIndex)) {
      accessibleOffset += direction;
    }

    const hoverIndex = accentIndex + accessibleOffset;
    const restIndex = hoverIndex + direction * -1 * hoverDelta;
    const activeIndex = restIndex + direction * accentFillActiveDelta(designSystem);
    const focusIndex = restIndex + direction * accentFillFocusDelta(designSystem);
    return {
      rest: getSwatch(restIndex, palette),
      hover: getSwatch(hoverIndex, palette),
      active: getSwatch(activeIndex, palette),
      focus: getSwatch(focusIndex, palette),
      selected: getSwatch(restIndex + (isDarkMode(designSystem) ? accentFillSelectedDelta(designSystem) * -1 : accentFillSelectedDelta(designSystem)), palette)
    };
  };
}

const accentFill = colorRecipeFactory(accentFillAlgorithm(4.5));
const accentFillLarge = colorRecipeFactory(accentFillAlgorithm(3));
const accentFillRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, accentFill);
const accentFillHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, accentFill);
const accentFillActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, accentFill);
const accentFillFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, accentFill);
const accentFillSelected = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.selected, accentFill);
const accentFillLargeRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, accentFillLarge);
const accentFillLargeHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, accentFillLarge);
const accentFillLargeActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, accentFillLarge);
const accentFillLargeFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, accentFillLarge);
const accentFillLargeSelected = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.selected, accentFillLarge);

const neutralCardFillAlgorithm = designSystem => {
  const offset = neutralFillCardDelta(designSystem);
  const index = findClosestSwatchIndex(neutralPalette$1, backgroundColor(designSystem))(designSystem);
  return getSwatch(index - (index < offset ? offset * -1 : offset), neutralPalette$1(designSystem));
};

function neutralFillCard(arg) {
  if (typeof arg === "function") {
    return designSystem => {
      return neutralCardFillAlgorithm(Object.assign({}, designSystem, {
        backgroundColor: arg(designSystem)
      }));
    };
  } else {
    return neutralCardFillAlgorithm(arg);
  }
}

const neutralOutlineAlgorithm = designSystem => {
  const palette = neutralPalette$1(designSystem);
  const backgroundIndex = findClosestBackgroundIndex(designSystem);
  const direction = isDarkMode(designSystem) ? -1 : 1;
  const restDelta = neutralOutlineRestDelta(designSystem);
  const restIndex = backgroundIndex + direction * restDelta;
  const hoverDelta = neutralOutlineHoverDelta(designSystem);
  const hoverIndex = restIndex + direction * (hoverDelta - restDelta);
  const activeDelta = neutralOutlineActiveDelta(designSystem);
  const activeIndex = restIndex + direction * (activeDelta - restDelta);
  const focusDelta = neutralOutlineFocusDelta(designSystem);
  const focusIndex = restIndex + direction * (focusDelta - restDelta);
  return {
    rest: getSwatch(restIndex, palette),
    hover: getSwatch(hoverIndex, palette),
    active: getSwatch(activeIndex, palette),
    focus: getSwatch(focusIndex, palette)
  };
};

const neutralOutline = colorRecipeFactory(neutralOutlineAlgorithm);
const neutralOutlineRest = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.rest, neutralOutline);
const neutralOutlineHover = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.hover, neutralOutline);
const neutralOutlineActive = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.active, neutralOutline);
const neutralOutlineFocus = swatchFamilyToSwatchRecipeFactory(SwatchFamilyType.focus, neutralOutline);

const neutralDividerAlgorithm = designSystem => {
  const palette = neutralPalette$1(designSystem);
  const backgroundIndex = findClosestBackgroundIndex(designSystem);
  const delta = neutralDividerRestDelta(designSystem);
  const direction = isDarkMode(designSystem) ? -1 : 1;
  const index = backgroundIndex + direction * delta;
  return getSwatch(index, palette);
};

const neutralDividerRest = colorRecipeFactory(neutralDividerAlgorithm);

/**
 * @deprecated Use the recipes because they can be more dynamic for different ramps
 */

var NeutralPaletteLightModeLayers;

(function (NeutralPaletteLightModeLayers) {
  NeutralPaletteLightModeLayers[NeutralPaletteLightModeLayers["L1"] = 0] = "L1";
  NeutralPaletteLightModeLayers[NeutralPaletteLightModeLayers["L1Alt"] = 3] = "L1Alt";
  NeutralPaletteLightModeLayers[NeutralPaletteLightModeLayers["L2"] = 10] = "L2";
  NeutralPaletteLightModeLayers[NeutralPaletteLightModeLayers["L3"] = 13] = "L3";
  NeutralPaletteLightModeLayers[NeutralPaletteLightModeLayers["L4"] = 16] = "L4";
})(NeutralPaletteLightModeLayers || (NeutralPaletteLightModeLayers = {}));
/**
 * @deprecated Use the recipes because they can be more dynamic for different ramps
 */


var NeutralPaletteDarkModeLayers;

(function (NeutralPaletteDarkModeLayers) {
  NeutralPaletteDarkModeLayers[NeutralPaletteDarkModeLayers["L1"] = 76] = "L1";
  NeutralPaletteDarkModeLayers[NeutralPaletteDarkModeLayers["L1Alt"] = 76] = "L1Alt";
  NeutralPaletteDarkModeLayers[NeutralPaletteDarkModeLayers["L2"] = 79] = "L2";
  NeutralPaletteDarkModeLayers[NeutralPaletteDarkModeLayers["L3"] = 82] = "L3";
  NeutralPaletteDarkModeLayers[NeutralPaletteDarkModeLayers["L4"] = 85] = "L4";
})(NeutralPaletteDarkModeLayers || (NeutralPaletteDarkModeLayers = {}));
/**
 * Recommended values for light and dark mode for `baseLayerLuminance` in the design system.
 */


var StandardLuminance;

(function (StandardLuminance) {
  StandardLuminance[StandardLuminance["LightMode"] = 1] = "LightMode";
  StandardLuminance[StandardLuminance["DarkMode"] = 0.23] = "DarkMode";
})(StandardLuminance || (StandardLuminance = {}));

function luminanceOrBackgroundColor(luminanceRecipe, backgroundRecipe) {
  return designSystem => {
    return baseLayerLuminance(designSystem) === -1 ? backgroundRecipe(designSystem) : luminanceRecipe(designSystem);
  };
}
/**
 * Find the palette color that's closest to the desired base layer luminance.
 */


const baseLayerLuminanceSwatch = designSystem => {
  const luminance = baseLayerLuminance(designSystem);
  return new ColorRGBA64(luminance, luminance, luminance, 1).toStringHexRGB();
};
/**
 * Get the index of the base layer palette color.
 */


const baseLayerLuminanceIndex = findClosestSwatchIndex(neutralPalette$1, baseLayerLuminanceSwatch);
/**
 * Get the actual value of the card layer index, clamped so we can use it to base other layers from.
 */

const neutralLayerCardIndex = designSystem => clamp(subtract(baseLayerLuminanceIndex, neutralFillCardDelta)(designSystem), 0, neutralPalette$1(designSystem).length - 1);
/**
 * Light mode L2 is significant because it happens at the same point as the neutral fill flip. Use this as the minimum index for L2.
 */


const lightNeutralLayerL2 = designSystemResolverMax(neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta);
/**
 * The index for L2 based on luminance, adjusted for the flip in light mode if necessary.
 */

const neutralLayerL2Index = designSystemResolverMax(add(baseLayerLuminanceIndex, neutralFillCardDelta), lightNeutralLayerL2);
/**
 * Dark mode L4 is the darkest recommended background in the standard guidance, which is
 * calculated based on luminance to work with variable sized ramps.
 */

const darkNeutralLayerL4 = designSystem => {
  const darkLum = 0.14;
  const darkColor = new ColorRGBA64(darkLum, darkLum, darkLum, 1);
  const darkRefIndex = findClosestSwatchIndex(neutralPalette$1, darkColor.toStringHexRGB())(designSystem);
  return darkRefIndex;
};
/**
 * Used as the background color for floating layers like context menus and flyouts.
 */


const neutralLayerFloating = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(subtract(neutralLayerCardIndex, neutralFillCardDelta), neutralPalette$1), swatchByMode(neutralPalette$1)(0, subtract(darkNeutralLayerL4, multiply(neutralFillCardDelta, 5)))));
/**
 * Used as the background color for cards. Pair with `neutralLayerCardContainer` for the container background.
 */

const neutralLayerCard = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(neutralLayerCardIndex, neutralPalette$1), swatchByMode(neutralPalette$1)(0, subtract(darkNeutralLayerL4, multiply(neutralFillCardDelta, 4)))));
/**
 * Used as the background color for card containers. Pair with `neutralLayerCard` for the card backgrounds.
 */

const neutralLayerCardContainer = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(add(neutralLayerCardIndex, neutralFillCardDelta), neutralPalette$1), swatchByMode(neutralPalette$1)(neutralFillCardDelta, subtract(darkNeutralLayerL4, multiply(neutralFillCardDelta, 3)))));
/**
 * Used as the background color for the primary content layer (L1).
 */

const neutralLayerL1 = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(baseLayerLuminanceIndex, neutralPalette$1), swatchByMode(neutralPalette$1)(0, subtract(darkNeutralLayerL4, multiply(neutralFillCardDelta, 3)))));
/**
 * Alternate darker color for L1 surfaces. Currently the same as card container, but use
 * the most applicable semantic named recipe.
 */

const neutralLayerL1Alt = neutralLayerCardContainer;
/**
 * Used as the background for the top command surface, logically below L1.
 */

const neutralLayerL2 = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(neutralLayerL2Index, neutralPalette$1), swatchByMode(neutralPalette$1)(lightNeutralLayerL2, subtract(darkNeutralLayerL4, multiply(neutralFillCardDelta, 2)))));
/**
 * Used as the background for secondary command surfaces, logically below L2.
 */

const neutralLayerL3 = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(add(neutralLayerL2Index, neutralFillCardDelta), neutralPalette$1), swatchByMode(neutralPalette$1)(add(lightNeutralLayerL2, neutralFillCardDelta), subtract(darkNeutralLayerL4, neutralFillCardDelta))));
/**
 * Used as the background for the lowest command surface or title bar, logically below L3.
 */

const neutralLayerL4 = colorRecipeFactory(luminanceOrBackgroundColor(getSwatch(add(neutralLayerL2Index, multiply(neutralFillCardDelta, 2)), neutralPalette$1), swatchByMode(neutralPalette$1)(add(lightNeutralLayerL2, multiply(neutralFillCardDelta, 2)), darkNeutralLayerL4)));

const targetRatio = 3.5;

function neutralFocusIndexResolver(referenceColor, palette, designSystem) {
  return findClosestSwatchIndex(neutralPalette$1, referenceColor)(designSystem);
}

function neutralFocusDirectionResolver(index, palette, designSystem) {
  return isDarkMode(designSystem) ? -1 : 1;
}

function neutralFocusContrastCondition(contrastRatio) {
  return contrastRatio > targetRatio;
}

const neutralFocusAlgorithm = swatchByContrast(backgroundColor)(neutralPalette$1)(neutralFocusIndexResolver)(neutralFocusDirectionResolver)(neutralFocusContrastCondition);
const neutralFocus = colorRecipeFactory(neutralFocusAlgorithm);

function neutralFocusInnerAccentIndexResolver(accentFillColor) {
  return (referenceColor, sourcePalette, designSystem) => {
    return sourcePalette.indexOf(accentFillColor(designSystem));
  };
}

function neutralFocusInnerAccentDirectionResolver(referenceIndex, palette, designSystem) {
  return isDarkMode(designSystem) ? 1 : -1;
}

function neutralFocusInnerAccent(accentFillColor) {
  return swatchByContrast(neutralFocus)(accentPalette$1)(neutralFocusInnerAccentIndexResolver(accentFillColor))(neutralFocusInnerAccentDirectionResolver)(neutralFocusContrastCondition);
}

function createColorPalette(baseColor) {
  return new ComponentStateColorPalette({
    baseColor
  }).palette.map(color => color.toStringHexRGB().toUpperCase());
}

const DesignSystemProviderStyles = css` ${display("block")};`;

const color = new CSSCustomPropertyBehavior("neutral-foreground-rest", neutralForegroundRest, el => el);
const backgroundStyles = css` :host{background-color: var(--background-color);color: ${color.var}}`.withBehaviors(color);
/**
 * The FAST DesignSystemProvider Element. Implements {@link @microsoft/fast-foundation#DesignSystemProvider},
 * {@link @microsoft/fast-foundation#DesignSystemProviderTemplate}
 *
 *
 * @public
 * @remarks
 * HTML Element: \<fast-design-system-provider\>
 */

let FASTDesignSystemProvider = class FASTDesignSystemProvider extends DesignSystemProvider {
  constructor() {
    super(...arguments);
    /**
     * Used to instruct the FASTDesignSystemProvider
     * that it should not set the CSS
     * background-color and color properties
     *
     * @remarks
     * HTML boolean boolean attribute: no-paint
     */

    this.noPaint = false;
  }

  noPaintChanged() {
    if (!this.noPaint && this.backgroundColor !== void 0) {
      this.$fastController.addStyles(backgroundStyles);
    } else {
      this.$fastController.removeStyles(backgroundStyles);
    }
  }

  backgroundColorChanged() {
    // If background changes or is removed, we need to
    // re-evaluate whether we should have paint styles applied
    this.noPaintChanged();
  }

};

__decorate([attr({
  attribute: "no-paint",
  mode: "boolean"
})], FASTDesignSystemProvider.prototype, "noPaint", void 0);

__decorate([designSystemProperty({
  attribute: "background-color",
  default: designSystemDefaults.backgroundColor
})], FASTDesignSystemProvider.prototype, "backgroundColor", void 0);

__decorate([designSystemProperty({
  attribute: "accent-base-color",
  cssCustomProperty: false,
  default: designSystemDefaults.accentBaseColor
})], FASTDesignSystemProvider.prototype, "accentBaseColor", void 0);

__decorate([designSystemProperty({
  attribute: false,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralPalette
})], FASTDesignSystemProvider.prototype, "neutralPalette", void 0);

__decorate([designSystemProperty({
  attribute: false,
  cssCustomProperty: false,
  default: designSystemDefaults.accentPalette
})], FASTDesignSystemProvider.prototype, "accentPalette", void 0);

__decorate([designSystemProperty({
  default: designSystemDefaults.density,
  converter: nullableNumberConverter
})], FASTDesignSystemProvider.prototype, "density", void 0);

__decorate([designSystemProperty({
  attribute: "design-unit",
  converter: nullableNumberConverter,
  default: designSystemDefaults.designUnit
})], FASTDesignSystemProvider.prototype, "designUnit", void 0);

__decorate([designSystemProperty({
  attribute: "direction",
  cssCustomProperty: false,
  default: designSystemDefaults.direction
})], FASTDesignSystemProvider.prototype, "direction", void 0);

__decorate([designSystemProperty({
  attribute: "base-height-multiplier",
  default: designSystemDefaults.baseHeightMultiplier,
  converter: nullableNumberConverter
})], FASTDesignSystemProvider.prototype, "baseHeightMultiplier", void 0);

__decorate([designSystemProperty({
  attribute: "base-horizontal-spacing-multiplier",
  converter: nullableNumberConverter,
  default: designSystemDefaults.baseHorizontalSpacingMultiplier
})], FASTDesignSystemProvider.prototype, "baseHorizontalSpacingMultiplier", void 0);

__decorate([designSystemProperty({
  attribute: "corner-radius",
  converter: nullableNumberConverter,
  default: designSystemDefaults.cornerRadius
})], FASTDesignSystemProvider.prototype, "cornerRadius", void 0);

__decorate([designSystemProperty({
  attribute: "elevated-corner-radius",
  converter: nullableNumberConverter,
  default: designSystemDefaults.elevatedCornerRadius
})], FASTDesignSystemProvider.prototype, "elevatedCornerRadius", void 0);

__decorate([designSystemProperty({
  attribute: "outline-width",
  converter: nullableNumberConverter,
  default: designSystemDefaults.outlineWidth
})], FASTDesignSystemProvider.prototype, "outlineWidth", void 0);

__decorate([designSystemProperty({
  attribute: "focus-outline-width",
  converter: nullableNumberConverter,
  default: designSystemDefaults.focusOutlineWidth
})], FASTDesignSystemProvider.prototype, "focusOutlineWidth", void 0);

__decorate([designSystemProperty({
  attribute: "disabled-opacity",
  converter: nullableNumberConverter,
  default: designSystemDefaults.disabledOpacity
})], FASTDesignSystemProvider.prototype, "disabledOpacity", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-minus-2-font-size",
  default: "10px"
})], FASTDesignSystemProvider.prototype, "typeRampMinus2FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-minus-2-line-height",
  default: "16px"
})], FASTDesignSystemProvider.prototype, "typeRampMinus2LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-minus-1-font-size",
  default: "12px"
})], FASTDesignSystemProvider.prototype, "typeRampMinus1FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-minus-1-line-height",
  default: "16px"
})], FASTDesignSystemProvider.prototype, "typeRampMinus1LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-base-font-size",
  default: "14px"
})], FASTDesignSystemProvider.prototype, "typeRampBaseFontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-base-line-height",
  default: "20px"
})], FASTDesignSystemProvider.prototype, "typeRampBaseLineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-1-font-size",
  default: "16px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus1FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-1-line-height",
  default: "24px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus1LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-2-font-size",
  default: "20px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus2FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-2-line-height",
  default: "28px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus2LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-3-font-size",
  default: "28px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus3FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-3-line-height",
  default: "36px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus3LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-4-font-size",
  default: "34px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus4FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-4-line-height",
  default: "44px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus4LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-5-font-size",
  default: "46px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus5FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-5-line-height",
  default: "56px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus5LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-6-font-size",
  default: "60px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus6FontSize", void 0);

__decorate([designSystemProperty({
  attribute: "type-ramp-plus-6-line-height",
  default: "72px"
})], FASTDesignSystemProvider.prototype, "typeRampPlus6LineHeight", void 0);

__decorate([designSystemProperty({
  attribute: "accent-fill-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentFillRestDelta
})], FASTDesignSystemProvider.prototype, "accentFillRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-fill-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentFillHoverDelta
})], FASTDesignSystemProvider.prototype, "accentFillHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-fill-active-delta",
  cssCustomProperty: false,
  converter: nullableNumberConverter,
  default: designSystemDefaults.accentFillActiveDelta
})], FASTDesignSystemProvider.prototype, "accentFillActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-fill-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentFillFocusDelta
})], FASTDesignSystemProvider.prototype, "accentFillFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-fill-selected-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentFillSelectedDelta
})], FASTDesignSystemProvider.prototype, "accentFillSelectedDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-foreground-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentForegroundRestDelta
})], FASTDesignSystemProvider.prototype, "accentForegroundRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-foreground-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentForegroundHoverDelta
})], FASTDesignSystemProvider.prototype, "accentForegroundHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-foreground-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentForegroundActiveDelta
})], FASTDesignSystemProvider.prototype, "accentForegroundActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "accent-foreground-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.accentForegroundFocusDelta
})], FASTDesignSystemProvider.prototype, "accentForegroundFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillRestDelta
})], FASTDesignSystemProvider.prototype, "neutralFillRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralFillHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralFillActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralFillFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-selected-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillSelectedDelta
})], FASTDesignSystemProvider.prototype, "neutralFillSelectedDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-input-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillInputRestDelta
})], FASTDesignSystemProvider.prototype, "neutralFillInputRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-input-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillInputHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralFillInputHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-input-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillInputActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralFillInputActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-input-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillInputFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralFillInputFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-input-selected-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillInputSelectedDelta
})], FASTDesignSystemProvider.prototype, "neutralFillInputSelectedDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-stealth-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillStealthRestDelta
})], FASTDesignSystemProvider.prototype, "neutralFillStealthRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-stealth-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillStealthHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralFillStealthHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-stealth-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillStealthActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralFillStealthActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-stealth-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillStealthFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralFillStealthFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-stealth-selected-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillStealthSelectedDelta
})], FASTDesignSystemProvider.prototype, "neutralFillStealthSelectedDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-toggle-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillToggleHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralFillToggleHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-toggle-hover-active",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillToggleActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralFillToggleActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-toggle-hover-focus",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillToggleFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralFillToggleFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "base-layer-luminance",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.baseLayerLuminance
})], FASTDesignSystemProvider.prototype, "baseLayerLuminance", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-fill-card-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralFillCardDelta
})], FASTDesignSystemProvider.prototype, "neutralFillCardDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-foreground-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralForegroundHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralForegroundHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-foreground-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralForegroundActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralForegroundActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-foreground-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralForegroundFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralForegroundFocusDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-divider-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralDividerRestDelta
})], FASTDesignSystemProvider.prototype, "neutralDividerRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-outline-rest-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralOutlineRestDelta
})], FASTDesignSystemProvider.prototype, "neutralOutlineRestDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-outline-hover-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralOutlineHoverDelta
})], FASTDesignSystemProvider.prototype, "neutralOutlineHoverDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-outline-active-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralOutlineActiveDelta
})], FASTDesignSystemProvider.prototype, "neutralOutlineActiveDelta", void 0);

__decorate([designSystemProperty({
  attribute: "neutral-outline-focus-delta",
  converter: nullableNumberConverter,
  cssCustomProperty: false,
  default: designSystemDefaults.neutralOutlineFocusDelta
})], FASTDesignSystemProvider.prototype, "neutralOutlineFocusDelta", void 0);

FASTDesignSystemProvider = __decorate([designSystemProvider({
  name: "fast-design-system-provider",
  template: DesignSystemProviderTemplate,
  styles: DesignSystemProviderStyles
})], FASTDesignSystemProvider);

/**
 * Behavior to resolve and make available the neutral-foreground-rest CSS custom property.
 * @public
 */

const neutralForegroundRestBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-rest", x => neutralForeground(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-hover CSS custom property.
 * @public
 */

const neutralForegroundHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-hover", x => neutralForeground(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-active CSS custom property.
 * @public
 */

const neutralForegroundActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-active", x => neutralForeground(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-focus CSS custom property.
 * @public
 */

const neutralForegroundFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-focus", x => neutralForeground(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-toggle CSS custom property.
 * @public
 */

const neutralForegroundToggleBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-toggle", neutralForegroundToggle, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-toggle-large CSS custom property.
 * @public
 */

const neutralForegroundToggleLargeBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-toggle-large", neutralForegroundToggleLarge, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-hint CSS custom property.
 * @public
 */

const neutralForegroundHintBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-hint", neutralForegroundHint, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-foreground-hint-large CSS custom property.
 * @public
 */

const neutralForegroundHintLargeBehavior = cssCustomPropertyBehaviorFactory("neutral-foreground-hint-large", neutralForegroundHintLarge, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-rest CSS custom property.
 * @public
 */

const accentForegroundRestBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-rest", x => accentForeground(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-hover CSS custom property.
 * @public
 */

const accentForegroundHoverBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-hover", x => accentForeground(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-active CSS custom property.
 * @public
 */

const accentForegroundActiveBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-active", x => accentForeground(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-focus CSS custom property.
 * @public
 */

const accentForegroundFocusBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-focus", x => accentForeground(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-cut-rest CSS custom property.
 * @public
 */

const accentForegroundCutRestBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-cut-rest", x => accentForegroundCut(x), FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-large-rest CSS custom property.
 * @public
 */

const accentForegroundLargeRestBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-large-rest", x => accentForegroundLarge(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-large-hover CSS custom property.
 * @public
 */

const accentForegroundLargeHoverBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-large-hover", x => accentForegroundLarge(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-large-active CSS custom property.
 * @public
 */

const accentForegroundLargeActiveBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-large-active", x => accentForegroundLarge(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-foreground-large-focus CSS custom property.
 * @public
 */

const accentForegroundLargeFocusBehavior = cssCustomPropertyBehaviorFactory("accent-foreground-large-focus", x => accentForegroundLarge(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-rest CSS custom property.
 * @public
 */

const neutralFillRestBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-rest", x => neutralFill(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-hover CSS custom property.
 * @public
 */

const neutralFillHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-hover", x => neutralFill(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-active CSS custom property.
 * @public
 */

const neutralFillActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-active", x => neutralFill(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-focus CSS custom property.
 * @public
 */

const neutralFillFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-focus", x => neutralFill(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-selected CSS custom property.
 * @public
 */

const neutralFillSelectedBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-selected", x => neutralFill(x).selected, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-stealth-rest CSS custom property.
 * @public
 */

const neutralFillStealthRestBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-stealth-rest", x => neutralFillStealth(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-stealth-hover CSS custom property.
 * @public
 */

const neutralFillStealthHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-stealth-hover", x => neutralFillStealth(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-stealth-active CSS custom property.
 * @public
 */

const neutralFillStealthActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-stealth-active", x => neutralFillStealth(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-stealth-focus CSS custom property.
 * @public
 */

const neutralFillStealthFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-stealth-focus", x => neutralFillStealth(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-stealth-selected CSS custom property.
 * @public
 */

const neutralFillStealthSelectedBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-stealth-selected", x => neutralFillStealth(x).selected, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-toggle-rest CSS custom property.
 * @public
 */

const neutralFillToggleRestBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-toggle-rest", x => neutralFillToggle(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-toggle-hover CSS custom property.
 * @public
 */

const neutralFillToggleHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-toggle-hover", x => neutralFillToggle(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-toggle-active CSS custom property.
 * @public
 */

const neutralFillToggleActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-toggle-active", x => neutralFillToggle(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-toggle-focus CSS custom property.
 * @public
 */

const neutralFillToggleFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-toggle-focus", x => neutralFillToggle(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-input-rest CSS custom property.
 * @public
 */

const neutralFillInputRestBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-input-rest", x => neutralFillInput(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-input-hover CSS custom property.
 * @public
 */

const neutralFillInputHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-input-hover", x => neutralFillInput(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-input-active CSS custom property.
 * @public
 */

const neutralFillInputActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-input-active", x => neutralFillInput(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-input-focus CSS custom property.
 * @public
 */

const neutralFillInputFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-input-focus", x => neutralFillInput(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-rest CSS custom property.
 * @public
 */

const accentFillRestBehavior = cssCustomPropertyBehaviorFactory("accent-fill-rest", x => accentFill(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-hover CSS custom property.
 * @public
 */

const accentFillHoverBehavior = cssCustomPropertyBehaviorFactory("accent-fill-hover", x => accentFill(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-active CSS custom property.
 * @public
 */

const accentFillActiveBehavior = cssCustomPropertyBehaviorFactory("accent-fill-active", x => accentFill(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-focus CSS custom property.
 * @public
 */

const accentFillFocusBehavior = cssCustomPropertyBehaviorFactory("accent-fill-focus", x => accentFill(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-selected CSS custom property.
 * @public
 */

const accentFillSelectedBehavior = cssCustomPropertyBehaviorFactory("accent-fill-selected", x => accentFill(x).selected, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-large-rest CSS custom property.
 * @public
 */

const accentFillLargeRestBehavior = cssCustomPropertyBehaviorFactory("accent-fill-large-rest", x => accentFillLarge(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-large-hover CSS custom property.
 * @public
 */

const accentFillLargeHoverBehavior = cssCustomPropertyBehaviorFactory("accent-fill-large-hover", x => accentFillLarge(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-large-active CSS custom property.
 * @public
 */

const accentFillLargeActiveBehavior = cssCustomPropertyBehaviorFactory("accent-fill-large-active", x => accentFillLarge(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-large-focus CSS custom property.
 * @public
 */

const accentFillLargeFocusBehavior = cssCustomPropertyBehaviorFactory("accent-fill-large-focus", x => accentFillLarge(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the accent-fill-large-selected CSS custom property.
 * @public
 */

const accentFillLargeSelectedBehavior = cssCustomPropertyBehaviorFactory("accent-fill-large-selected", x => accentFillLarge(x).selected, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-fill-card-rest CSS custom property.
 * @public
 */

const neutralFillCardRestBehavior = cssCustomPropertyBehaviorFactory("neutral-fill-card-rest", x => neutralFillCard(x), FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-outline-rest CSS custom property.
 * @public
 */

const neutralOutlineRestBehavior = cssCustomPropertyBehaviorFactory("neutral-outline-rest", x => neutralOutline(x).rest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-outline-hover CSS custom property.
 * @public
 */

const neutralOutlineHoverBehavior = cssCustomPropertyBehaviorFactory("neutral-outline-hover", x => neutralOutline(x).hover, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-outline-active CSS custom property.
 * @public
 */

const neutralOutlineActiveBehavior = cssCustomPropertyBehaviorFactory("neutral-outline-active", x => neutralOutline(x).active, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-outline-focus CSS custom property.
 * @public
 */

const neutralOutlineFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-outline-focus", x => neutralOutline(x).focus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-divider-rest CSS custom property.
 * @public
 */

const neutralDividerRestBehavior = cssCustomPropertyBehaviorFactory("neutral-divider-rest", neutralDividerRest, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-floating CSS custom property.
 * @public
 */

const neutralLayerFloatingBehavior = cssCustomPropertyBehaviorFactory("neutral-layer-floating", neutralLayerFloating, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-card CSS custom property.
 * @public
 */

const neutralLayerCardBehavior = cssCustomPropertyBehaviorFactory("neutral-layer-card", neutralLayerCard, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-card-container CSS custom property.
 * @public
 */

const neutralLayerCardContainerBehavior = cssCustomPropertyBehaviorFactory("neutral-layer-card-container", neutralLayerCardContainer, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-l1 CSS custom property.
 * @public
 */

const neutralLayerL1Behavior = cssCustomPropertyBehaviorFactory("neutral-layer-l1", neutralLayerL1, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-l1-alt CSS custom property.
 * @public
 */

const neutralLayerL1AltBehavior = cssCustomPropertyBehaviorFactory("neutral-layer-l1-alt", neutralLayerL1Alt, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-l2 CSS custom property.
 * @public
 */

const neutralLayerL2Behavior = cssCustomPropertyBehaviorFactory("neutral-layer-l2", neutralLayerL2, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-l3 CSS custom property.
 * @public
 */

const neutralLayerL3Behavior = cssCustomPropertyBehaviorFactory("neutral-layer-l3", neutralLayerL3, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-layer-l4 CSS custom property.
 * @public
 */

const neutralLayerL4Behavior = cssCustomPropertyBehaviorFactory("neutral-layer-l4", neutralLayerL4, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-focus CSS custom property.
 * @public
 */

const neutralFocusBehavior = cssCustomPropertyBehaviorFactory("neutral-focus", neutralFocus, FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the neutral-focus-inner-accent CSS custom property.
 * @public
 */

const neutralFocusInnerAccentBehavior = cssCustomPropertyBehaviorFactory("neutral-focus-inner-accent", neutralFocusInnerAccent(accentBaseColor), FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the inline-start CSS custom property.
 *
 * @remarks
 * Replaces the inline-start value for the {@link https://developer.mozilla.org/en-US/docs/Web/CSS/float | float} property
 * when the native value is not supported.
 *
 * @public
 * @example
 * ```ts
 * import { css } from "@microsoft/fast-element";
 * import { inlineStartBehavior } from "@microsoft/fast-components-msft";
 *
 * css`
 *   :host {
 *     float: ${inlineStartBehavior.var};
 *   }
 * `.withBehaviors(inlineStartBehavior)
 * ```
 */

const inlineStartBehavior = cssCustomPropertyBehaviorFactory("inline-start", designSystem => direction(designSystem) === Direction.ltr ? "left" : "right", FASTDesignSystemProvider.findProvider);
/**
 * Behavior to resolve and make available the inline-end CSS custom property.
 *
 * @remarks
 * Replaces the inline-end value for the {@link https://developer.mozilla.org/en-US/docs/Web/CSS/float | float} property
 * when the native value is not supported.
 *
 * @public
 * @example
 * ```ts
 * import { css } from "@microsoft/fast-element";
 * import { inlineEndBehavior } from "@microsoft/fast-components-msft";
 *
 * css`
 *   :host {
 *     float: ${inlineEndBehavior.var};
 *   }
 * `.withBehaviors(inlineEndBehavior)
 * ```
 */

const inlineEndBehavior = cssCustomPropertyBehaviorFactory("inline-end", designSystem => direction(designSystem) === Direction.ltr ? "right" : "left", FASTDesignSystemProvider.findProvider);

/**
 * The height of height of a standard control (expressed as a number) to be used in CSS.
 * @public
 */
const heightNumber = "(var(--base-height-multiplier) + var(--density)) * var(--design-unit)";

/**
 * @internal
 */

const BaseButtonStyles = css` ${display("inline-flex")} :host{font-family: var(--body-font);outline: none;font-size: var(--type-ramp-base-font-size);line-height: var(--type-ramp-base-line-height);height: calc(${heightNumber} * 1px);min-width: calc(${heightNumber} * 1px);background-color: ${neutralFillRestBehavior.var};color: ${neutralForegroundRestBehavior.var};border-radius: calc(var(--corner-radius) * 1px);fill: currentColor;cursor: pointer}.control{background: transparent;height: inherit;flex-grow: 1;box-sizing: border-box;display: inline-flex;justify-content: center;align-items: center;padding: 0 calc((10 + (var(--design-unit) * 2 * var(--density))) * 1px);white-space: nowrap;outline: none;text-decoration: none;border: calc(var(--outline-width) * 1px) solid transparent;color: inherit;border-radius: inherit;fill: inherit;cursor: inherit}:host(:hover){background-color: ${neutralFillHoverBehavior.var}}:host(:active){background-color: ${neutralFillActiveBehavior.var}}.control:${focusVisible}{border: calc(var(--outline-width) * 1px) solid ${neutralFocusBehavior.var};box-shadow: 0 0 0 calc((var(--focus-outline-width) - var(--outline-width)) * 1px) ${neutralFocusBehavior.var}}.control::-moz-focus-inner{border: 0}:host(.disabled){opacity: var(--disabled-opacity);background-color: ${neutralFillRestBehavior.var};cursor: ${disabledCursor}}.start, .end, ::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px}.start{margin-inline-end: 11px}.end{margin-inline-start: 11px}`.withBehaviors(neutralFillRestBehavior, neutralForegroundRestBehavior, neutralFillHoverBehavior, neutralFillActiveBehavior);
/**
 * @internal
 */

const AccentButtonStyles = css` :host(.accent){background: ${accentFillRestBehavior.var};color: ${accentForegroundCutRestBehavior.var}}:host(.accent:hover){background: ${accentFillHoverBehavior.var}}:host(.accent:active) .control:active{background: ${accentFillActiveBehavior.var}}:host(.accent) .control:${focusVisible}{box-shadow: 0 0 0 calc(var(--focus-outline-width) * 1px) inset ${neutralFocusInnerAccentBehavior.var}}:host(.accent.disabled){background: ${accentFillRestBehavior.var}}`.withBehaviors(accentFillRestBehavior, accentForegroundCutRestBehavior, accentFillHoverBehavior, accentFillActiveBehavior, neutralFocusInnerAccentBehavior);
/**
 * @internal
 */

const HypertextStyles = css` :host(.hypertext){height: auto;font-size: inherit;line-height: inherit;background: transparent}:host(.hypertext) .control{display: inline;padding: 0;border: none;box-shadow: none;border-radius: 0;line-height: 1}:host a.control:not(:link){background-color: transparent;cursor: default}:host(.hypertext) .control:link, :host(.hypertext) .control:visited{background: transparent;color: ${accentForegroundRestBehavior.var};border-bottom: calc(var(--outline-width) * 1px) solid ${accentForegroundRestBehavior.var}}:host(.hypertext) .control:hover{border-bottom-color: ${accentForegroundHoverBehavior.var}}:host(.hypertext) .control:active{border-bottom-color: ${accentForegroundActiveBehavior.var}}:host(.hypertext) .control:${focusVisible}{border-bottom: calc(var(--focus-outline-width) * 1px) solid ${neutralFocusBehavior.var}}`.withBehaviors(accentForegroundRestBehavior, accentForegroundHoverBehavior, accentForegroundActiveBehavior, neutralFocusBehavior);
/**
 * @internal
 */

const LightweightButtonStyles = css` :host(.lightweight){background: transparent;color: ${accentForegroundRestBehavior.var}}:host(.lightweight) .control{padding: 0;height: initial;border: none;box-shadow: none;border-radius: 0}:host(.lightweight:hover){color: ${accentForegroundHoverBehavior.var}}:host(.lightweight:active){color: ${accentForegroundActiveBehavior.var}}:host(.lightweight) .content{position: relative}:host(.lightweight) .content::before{content: "";display: block;height: calc(var(--outline-width) * 1px);position: absolute;top: calc(1em + 3px);width: 100%}:host(.lightweight:hover) .content::before{background: ${accentForegroundHoverBehavior.var}}:host(.lightweight:active) .content::before{background: ${accentForegroundActiveBehavior.var}}:host(.lightweight) .control:${focusVisible} .content::before{background: ${neutralForegroundRestBehavior.var};height: calc(var(--focus-outline-width) * 1px)}:host(.lightweight.disabled) .content::before{background: transparent}`.withBehaviors(accentForegroundRestBehavior, accentForegroundHoverBehavior, accentForegroundActiveBehavior, accentForegroundHoverBehavior, neutralForegroundRestBehavior);
/**
 * @internal
 */

const OutlineButtonStyles = css` :host(.outline){background: transparent;border-color: ${neutralOutlineRestBehavior.var}}:host(.outline:hover){border-color: ${neutralOutlineHoverBehavior.var}}:host(.outline:active){border-color: ${neutralOutlineActiveBehavior.var}}:host(.outline) .control{border-color: inherit}:host(.outline) .control:${focusVisible}{border: calc(var(--outline-width) * 1px) solid ${neutralFocusBehavior.var});box-shadow: 0 0 0 calc((var(--focus-outline-width) - var(--outline-width)) * 1px) ${neutralFocusBehavior.var}}:host(.outline.disabled){border-color: ${neutralOutlineRestBehavior.var}}`.withBehaviors(neutralOutlineRestBehavior, neutralOutlineHoverBehavior, neutralOutlineActiveBehavior, neutralFocusBehavior);
/**
 * @internal
 */

const StealthButtonStyles = css` :host(.stealth){background: ${neutralFillStealthRestBehavior.var}}:host(.stealth:hover){background: ${neutralFillStealthHoverBehavior.var}}:host(.stealth:active){background: ${neutralFillStealthActiveBehavior.var}}:host(.stealth.disabled){background: ${neutralFillStealthRestBehavior.var}}`.withBehaviors(neutralFillStealthRestBehavior, neutralFillStealthHoverBehavior, neutralFillStealthActiveBehavior);

const FluentTextFieldStyles = css` ${display("inline-block")} :host{font-family: var(--body-font);outline: none;user-select: none}.root{box-sizing: border-box;position: relative;display: flex;flex-direction: row;color: ${neutralForegroundRestBehavior.var};background: ${neutralFillInputRestBehavior.var};border-radius: calc(var(--corner-radius) * 1px);border: calc(var(--outline-width) * 1px) solid ${neutralOutlineRestBehavior.var};height: calc(${heightNumber} * 1px)}.control{-webkit-appearance: none;background: transparent;border: 0;height: calc(100% - 4px);margin-top: auto;margin-bottom: auto;border: none;padding: 0 calc(var(--design-unit) * 2px + 1px);color: ${neutralForegroundRestBehavior.var};font-size: var(--type-ramp-base-font-size);line-height: var(--type-ramp-base-line-height)}.control:hover, .control:${focusVisible}, .control:disabled, .control:active{outline: none}:host(.no-label.required) .root::before{content: '*';color: #a4262c;position:absolute;top:-5px;right:-10px}.label__hidden{display: none;visibility: hidden}.label{display: block;color: ${neutralForegroundRestBehavior.var};cursor: pointer;font-size: var(--type-ramp-base-font-size);line-height: var(--type-ramp-base-line-height);margin-bottom: 4px}.before-content, .after-content{${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px;margin: auto;fill: ${neutralForegroundRestBehavior.var}}.before-content{margin-inline-start: 11px}.after-content{margin-inline-end: 11px}:host(:hover:not(.disabled)) .root{background: ${neutralFillInputHoverBehavior.var};border-color: ${neutralOutlineHoverBehavior.var}}:host(:focus-within:not(.disabled)) .root{border-color: ${neutralFocusBehavior.var};box-shadow: 0 0 0 1px ${neutralFocusBehavior.var} inset}:host(.filled) .root{background: ${neutralFillRestBehavior.var};border-color: transparent}:host(.filled:hover:not(.disabled)) .root{background: ${neutralFillHoverBehavior.var};border-color: transparent}:host(.disabled) .label, :host(.readonly) .label, :host(.readonly) .control, :host(.disabled) .control{cursor: ${disabledCursor}}:host(.disabled){opacity: var(--disabled-opacity)}`.withBehaviors(neutralFillHoverBehavior, neutralFillInputHoverBehavior, neutralFillInputRestBehavior, neutralFillRestBehavior, neutralFocusBehavior, neutralForegroundRestBehavior, neutralOutlineHoverBehavior, neutralOutlineRestBehavior, forcedColorsStylesheetBehavior(css` .root, :host(.filled) .root{forced-color-adjust: none;background: ${SystemColors.Field};border-color: ${SystemColors.FieldText}}:host(:hover:not(.disabled)) .root, :host(.filled:hover:not(.disabled)) .root, :host(.filled:hover) .root{background: ${SystemColors.Field};border-color: ${SystemColors.Highlight}}.before-content, .after-content{fill: ${SystemColors.ButtonText}}:host(.disabled){opacity: 1}:host(.disabled) .root, :host(.filled:hover.disabled) .root{border-color: ${SystemColors.GrayText};background: ${SystemColors.Field}}:host(:focus-within:enabled) .root{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 1px ${SystemColors.Highlight} inset}.control{color: ${SystemColors.ButtonText}}`));

/**
 * The FAST Text Field Custom Element. Implements {@link @microsoft/fast-foundation#TextField},
 * {@link @microsoft/fast-foundation#TextFieldTemplate}
 *
 *
 * @public
 * @remarks
 * HTML Element: \<fast-text-field\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */

let FluentTextField = class FluentTextField extends TextField {
  /**
   * @internal
   */
  appearanceChanged(oldValue, newValue) {
    if (newValue === undefined) {
      console.log("newValue is undefined");
    } else {
      console.log("newValue is " + newValue);
    }

    if (oldValue !== newValue) {
      this.classList.add(newValue);
      this.classList.remove(oldValue);
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "outline";
    }
  }

};

__decorate([attr], FluentTextField.prototype, "appearance", void 0);

__decorate([attr], FluentTextField.prototype, "label", void 0);

FluentTextField = __decorate([customElement({
  name: "fast-fluent-text-field",
  template: FluentTextFieldTemplate,
  styles: FluentTextFieldStyles,
  shadowOptions: {
    delegatesFocus: true
  }
})], FluentTextField);

export { ARIAGlobalStatesAndProperties, Accordion, AccordionExpandMode, AccordionItem, AccordionItemTemplate, AccordionTemplate, Anchor, AnchorTemplate, AttachedBehaviorDirective, AttributeDefinition, Badge, BadgeTemplate, BaseProgress, BindingBehavior, BindingDirective, Button, ButtonTemplate, CSSCustomPropertyBehavior, Card, CardTemplate, Checkbox, CheckboxTemplate, ChildrenBehavior, Controller, DOM, DelegatesARIAButton, DelegatesARIALink, DelegatesARIATextbox, DesignSystemProvider, DesignSystemProviderTemplate, Dialog, DialogTemplate, Directive, Divider, DividerRole, DividerTemplate, ElementStyles, ExecutionContext, FASTElement, FASTElementDefinition, Flipper, FlipperDirection, FlipperTemplate, FluentLabel, FluentList, FluentTextField, FluentTextFieldTemplate, HTMLView, LabelTemplate, ListTemplate, MatchMediaBehavior, MatchMediaStyleSheetBehavior, Menu, MenuItem, MenuItemRole, MenuItemTemplate, MenuTemplate, Observable, ProgressRingTemplate, ProgressTemplate, PropertyChangeNotifier, Radio, RadioGroup, RadioGroupTemplate, RadioTemplate, RefBehavior, RepeatBehavior, RepeatDirective, Slider, SliderLabel, SliderLabelTemplate, SliderMode, SliderTemplate, SlottedBehavior, StartEnd, SubscriberSet, Switch, SwitchTemplate, Tab, TabPanel, TabPanelTemplate, TabTemplate, Tabs, TabsOrientation, TabsTemplate, TextArea, TextAreaResize, TextAreaTemplate, TextField, TextFieldTemplate, TextFieldType, TreeItem, TreeItemTemplate, TreeView, TreeViewTemplate, ViewTemplate, applyMixins, attr, booleanConverter, children, compileTemplate, composedParent, createColorPalette, css, cssCustomPropertyBehaviorFactory, customElement, defaultExecutionContext, designSystemConsumerBehavior, designSystemProperty, designSystemProvider, disabledCursor, display, elements, emptyArray, endTemplate, focusVisible, forcedColorsStylesheetBehavior, hidden, html, isDesignSystemConsumer, isTreeItemElement, matchMediaStylesheetBehaviorFactory, nullableNumberConverter, observable, ref, repeat, setCurrentEvent, slotted, startTemplate, volatile, when };

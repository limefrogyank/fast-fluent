#pragma checksum "C:\Users\Lee\source\repos\fast-fluent\blazorlib\BFUTextField.razor" "{ff1816ec-aa5e-4d10-87f7-6f4963833460}" "afb6272a514c3b52ac50d3c39a88027546a68597"
// <auto-generated/>
#pragma warning disable 1591
namespace BlazorFluentUi
{
    #line hidden
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Components;
#nullable restore
#line 1 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\_Imports.razor"
using Microsoft.AspNetCore.Components.Web;

#line default
#line hidden
#nullable disable
#nullable restore
#line 2 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\_Imports.razor"
using Microsoft.JSInterop;

#line default
#line hidden
#nullable disable
    public partial class BFUTextField : Microsoft.AspNetCore.Components.ComponentBase
    {
        #pragma warning disable 1998
        protected override void BuildRenderTree(Microsoft.AspNetCore.Components.Rendering.RenderTreeBuilder __builder)
        {
            __builder.OpenElement(0, "fast-fluent-text-field");
            __builder.AddAttribute(1, "disabled", 
#nullable restore
#line 1 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\BFUTextField.razor"
                                  Disabled

#line default
#line hidden
#nullable disable
            );
            __builder.AddAttribute(2, "required", 
#nullable restore
#line 2 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\BFUTextField.razor"
                                  Required

#line default
#line hidden
#nullable disable
            );
            __builder.AddAttribute(3, "label", 
#nullable restore
#line 3 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\BFUTextField.razor"
                               Label

#line default
#line hidden
#nullable disable
            );
            __builder.CloseElement();
        }
        #pragma warning restore 1998
#nullable restore
#line 5 "C:\Users\Lee\source\repos\fast-fluent\blazorlib\BFUTextField.razor"
      
    [Parameter] public bool Disabled {get; set;}
    [Parameter] public string Label {get; set;}
    [Parameter] public bool Required {get; set;}

#line default
#line hidden
#nullable disable
    }
}
#pragma warning restore 1591

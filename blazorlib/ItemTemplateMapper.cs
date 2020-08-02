using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;

namespace BlazorFluentUi{
        public class ItemTemplateMapper<TItem> : DynamicObject
        {
            public ItemTemplateMapper()
            {
                var map = CreatePropsAndFields(typeof(TItem));
                
            }

            public dynamic CreatePropsAndFields(Type reference)
            {        
                var props = reference.GetProperties();
                var fields = reference.GetFields().Where(x=>x.IsPublic);
                var itemMapper = new System.Dynamic.ExpandoObject();
                foreach (var prop in props)
                {
                    if (prop.PropertyType.IsClass && prop.PropertyType != typeof(string))
                    {
                        var dynamicItem = CreatePropsAndFields(prop.PropertyType);
                        ((IDictionary<String, Object>)itemMapper).Add(prop.Name, dynamicItem);
                    }
                    else
                        ((IDictionary<String, Object>)itemMapper).Add(prop.Name, $"${{item.{prop.Name}}}");
                }
                foreach (var field in fields)
                {
                    if (field.FieldType.IsClass && field.FieldType != typeof(string))
                    {
                        var dynamicItem = CreatePropsAndFields(field.FieldType);
                        ((IDictionary<String, Object>)itemMapper).Add(field.Name, dynamicItem);
                    }
                    else
                        ((IDictionary<String, Object>)itemMapper).Add(field.Name, $"${{item.{field.Name}}}");
                }
                return itemMapper;
            }

        }
    }
import {createSelector} from 'reselect';
import {
  addIndex,
  compose,
  filter,
  has,
  indexBy,
  map,
  prop,
  identity,
} from 'ramda';
import {enhanceInputOnChange, normalizeInputChangeValue} from './helpers';
import {createElement} from 'react';

const mapWithKey = addIndex(map);

const isDirtySelector = model => model.dirty;
const fieldsSelector = model => model.fields;
const defaultValuesSelector = model => model.defaultValues;
const schemaSelector = (model, {schema}) => schema;
const simpleFieldsMapSelector = (model, {fieldTypes}) => fieldTypes;
const handleOnChangeSelector = (model, {handleOnChange}) => handleOnChange;
const formGroupTemplateSelector = (model, {formGroupTemplate}) =>
  formGroupTemplate;

/*
const mEnhance = memoize(
  compose(
    enhanceInputOnChange,
    normalizeInputChangeValue
  )
);
*/

const fieldTypesSelector = createSelector(
  simpleFieldsMapSelector,
  //map(mEnhance)
  identity
);

const visibleFieldsSelectorCreator = () =>
  createSelector(
    fieldsSelector,
    schemaSelector,
    formGroupTemplateSelector,
    fieldTypesSelector,
    handleOnChangeSelector,
    (fields, schema, formGroupTemplate, fieldTypes, handleOnChange) =>
      mapWithKey(
        (f, idx) =>
          createElement(formGroupTemplate, {
            key: idx,
            title: f.title,
            input: createElement(fieldTypes[f.type || 'text'], {
              id: (name || '') + (name ? '-' : '') + f.id,
              title: f.title,
              value:
                fields[
                  f.debounce && has(`${f.id}_raw`, fields)
                    ? `${f.id}_raw`
                    : f.id
                ],
              onChange: handleOnChange,
              type: f.type || 'text',
              //error: this.getFieldError(f),
              //runValidation: model.submitDirty && model.dirty,
              scope: `sub.${f.id}`,
              ...(f.props ? f.props(this.props.args, fields) : {}),
            }),
          }),
        filter(f => !f.visible || f.visible(fields), schema)
      )
  );

const indexedSchemaSelector = createSelector(
  schemaSelector,
  indexBy(prop('id'))
);

export {
  isDirtySelector,
  fieldsSelector,
  defaultValuesSelector,
  visibleFieldsSelectorCreator,
  indexedSchemaSelector,
  fieldTypesSelector,
};

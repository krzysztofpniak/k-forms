import {createSelector} from 'reselect';
import {compose, filter, indexBy, prop, map, memoize, identity} from 'ramda';
import {normalizeInputChangeValue, enhanceInputOnChange} from './helpers';

const isDirtySelector = model => model.dirty;
const fieldsSelector = model => model.fields;
const defaultValuesSelector = model => model.defaultValues;
const schemaSelector = (model, {schema}) => schema;
const simpleFieldsMapSelector = (model, {fieldTypes}) => fieldTypes;

const visibleFieldsSelector = createSelector(
  fieldsSelector,
  schemaSelector,
  (fields, schema) => filter(f => !f.visible || f.visible(fields), schema)
);

const indexedSchemaSelector = createSelector(
  schemaSelector,
  indexBy(prop('id'))
);

const mEnhance = memoize(
  compose(
    enhanceInputOnChange,
    normalizeInputChangeValue
  )
);

const fieldTypesSelector = createSelector(
  simpleFieldsMapSelector,
  map(mEnhance)
);

export {
  isDirtySelector,
  fieldsSelector,
  defaultValuesSelector,
  visibleFieldsSelector,
  indexedSchemaSelector,
  fieldTypesSelector,
};

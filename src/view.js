import React, {createElement} from 'react';
import {
  filter,
  map,
  identity,
  find,
  addIndex,
  compose,
  mapObjIndexed,
  fromPairs,
  merge,
  has,
} from 'ramda';
import {forwardTo} from 'k-reducer';
import {setField, submit, reset, setSubmitDirty} from './actions';
import {
  visibleFieldsSelector,
  indexedSchemaSelector,
  fieldTypesSelector,
} from './selectors';
import {createUpdaterCreator} from './updater';
import {withProps, defaultProps} from 'recompose';
import {fetchOnEvery, handleAsyncs, KLogicContext, withScope} from 'k-logic';
const mapWithKey = addIndex(map);

const validateField = (fieldSchema, model) =>
  Array.isArray(fieldSchema.validate)
    ? find(
        identity,
        map(
          validationRule =>
            validationRule(
              model.fields[fieldSchema.id],
              model.fields,
              fieldSchema,
              !!model.debouncing[fieldSchema.id]
            ),
          fieldSchema.validate
        )
      ) || ''
    : typeof fieldSchema.validate === 'function'
      ? fieldSchema.validate(
          model.fields[fieldSchema.id],
          model.fields,
          fieldSchema,
          !!model.debouncing[fieldSchema.id]
        )
      : '';

const validateForm = (schema, model, asyncErrors) =>
  compose(
    filter(f => f.error || f.asyncErrors),
    map(f => ({
      id: f.id,
      error: validateField(f, model),
      asyncError: asyncErrors[f.id] || '',
    })),
    filter(f => !f.visible || f.visible(model.fields))
  )(schema);

const boolWithDefault = (defaultValue, value) =>
  value != null ? value : defaultValue;

const GenericError = ({content}) => (
  <div className="alert alert-danger" role="alert">
    {content}
  </div>
);

class ElmForm extends React.PureComponent {
  static contextType = KLogicContext;

  constructor() {
    super();
    this.controls = {};
    this.timeouts = {};
    this.setFieldValue = this.setFieldValue.bind(this);
    this.handleOnChange = this.handleOnChange.bind(this);
    this.defaultSubmitHandler = this.defaultSubmitHandler.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.defaultCancelHandler = this.defaultCancelHandler.bind(this);
    this.handleInputRef = this.handleInputRef.bind(this);
    this.getFieldError = this.getFieldError.bind(this);
    this.getInputComponent = this.getInputComponent.bind(this);
    this.getModel = this.getModel.bind(this);
  }

  getModel() {
    return this.context.state.fields ? this.context.state : {fields: {}};
  }

  componentDidMount() {
    const visibleFields = visibleFieldsSelector(this.getModel(), this.props);
    if (visibleFields && visibleFields.length > 0) {
      const firstField = visibleFields[0];
      const firstControl = this.controls[firstField.id];
      if (firstControl && firstControl.focus) {
        firstControl.focus();
      }
    }
    this.context.assocReducer(
      [...this.context.scope, '.'],
      createUpdaterCreator(this.props.fieldTypes)(this.props.schema)
    );
  }

  componentWillUnmount() {
    this.context.dissocReducer([...this.context.scope, '.']);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.asyncErrors !== this.props.asyncErrors) {
      const fields = visibleFieldsSelector(this.getModel(), this.props);
      const fieldWithAsyncError = find(
        field => nextProps.asyncErrors[field.id],
        fields
      );
      if (
        fieldWithAsyncError &&
        this.controls[fieldWithAsyncError.id] &&
        this.controls[fieldWithAsyncError.id].focus
      ) {
        setTimeout(() => this.controls[fieldWithAsyncError.id].focus(), 0);
      }
    }
  }
  defaultCancelHandler() {
    const {resetOnCancel} = this.props;
    const dispatch = this.context.dispatch;
    dispatch(reset({resetOnCancel: boolWithDefault(true, resetOnCancel)}));
  }
  handleCancel() {
    const {onCancel} = this.props;
    return onCancel
      ? onCancel(this.defaultCancelHandler)
      : this.defaultCancelHandler();
  }
  defaultSubmitHandler() {
    const {schema, resetOnSubmit, asyncErrors} = this.props;
    const dispatch = this.context.dispatch;
    const model = this.getModel();
    const formErrors = validateForm(schema, model, asyncErrors || {});
    const syncErrors = filter(e => e.error, formErrors);

    const fieldsDefaults = compose(
      fromPairs,
      map(field => [field.id, null])
    )(schema);

    const fields = merge(fieldsDefaults, model.fields);

    const fieldsValues = mapObjIndexed(
      (val, key) =>
        this.controls[key] && this.controls[key].type === 'file'
          ? this.controls[key].files
          : val,
      fields
    );

    dispatch(
      syncErrors.length === 0
        ? submit({
            fields: fieldsValues,
            resetOnSubmit: boolWithDefault(true, resetOnSubmit),
          })
        : setSubmitDirty()
    );
    if (formErrors.length > 0) {
      const erroredInput = this.controls[formErrors[0].id];
      if (erroredInput) {
        erroredInput.focus();
      }
    }
    return formErrors;
  }
  handleSubmit(e) {
    e.preventDefault();
    const {onSubmit} = this.props;
    const model = this.getModel();
    return onSubmit
      ? onSubmit(this.defaultSubmitHandler, model.fields)
      : this.defaultSubmitHandler();
  }
  getFieldError(field) {
    const {asyncErrors} = this.props;
    const model = this.getModel();
    const fieldAsyncError = (asyncErrors || {})[field.id];
    const asyncError = !model.dirty && !model.submitDirty && fieldAsyncError;

    return (
      asyncError ||
      ((model.submitDirty || (fieldAsyncError && model.dirty)) &&
        validateField(field, model))
    );
  }
  setFieldValue(id, value) {
    const dispatch = this.context.dispatch;
    const model = this.getModel();
    const fields = indexedSchemaSelector(model, this.props);
    const field = fields[id];
    if (field.debounce) {
      dispatch(setField(id, value, 'start'));
      clearTimeout(this.timeouts[id]);
      this.timeouts[id] = setTimeout(
        () => dispatch(setField(id, value, 'end')),
        field.debounce
      );
    } else {
      dispatch(setField(id, value));
    }
  }
  handleOnChange(value, fieldId) {
    const model = this.getModel();
    const fields = indexedSchemaSelector(model, this.props);
    const field = fields[fieldId];
    if (field.onChange) {
      const currentValue = model.fields[field.id];
      const overriddenValue = field.onChange(value, currentValue);
      const newValue = overriddenValue != null ? overriddenValue : currentValue;
      if (newValue != currentValue) {
        this.setFieldValue(field.id, newValue);
      }
    } else {
      this.setFieldValue(field.id, value);
    }
  }
  handleInputRef(ref, fieldId) {
    this.controls[fieldId] = ref;
  }
  getInputComponent(type) {
    return fieldTypesSelector(null, this.props)[type];
  }
  render() {
    const {
      legend,
      asyncErrors,
      name,
      formTemplate,
      formGroupTemplate,
      buttonsTemplate,
    } = this.props;

    const model = this.getModel();

    const fields = mapWithKey(
      (f, idx) =>
        createElement(formGroupTemplate, {
          key: idx,
          label: f.label,
          input: createElement(this.getInputComponent(f.type || 'text'), {
            id: (name || '') + (name ? '-' : '') + f.id,
            label: f.label,
            value:
              model.fields[
                f.debounce && has(`${f.id}_raw`, model.fields)
                  ? `${f.id}_raw`
                  : f.id
              ],
            onChange: this.handleOnChange,
            type: f.type || 'text',
            error: this.getFieldError(f),
            runValidation: model.submitDirty && model.dirty,
            scope: `sub.${f.id}`,
            ...(f.props ? f.props(this.props.args, model.fields) : {}),
          }),
        }),
      visibleFieldsSelector(model, this.props)
    );

    const genericError = asyncErrors &&
      asyncErrors.__general && <GenericError content={asyncErrors.__general} />;

    const buttons = createElement(buttonsTemplate, {
      submit: this.handleSubmit,
      onReset: this.handleCancel,
    });

    return createElement(formTemplate, {
      fields,
      buttons,
      genericError,
      legend,
      submit: this.handleSubmit,
    });
  }
}

const FormTemplate = ({fields, buttons}) => (
  <div>
    {fields} {buttons}
  </div>
);

const FormGroupTemplate = ({label, input}) => (
  <div>
    {label} {input}
  </div>
);

const ButtonsTemplate = ({submit, onReset}) => (
  <div>
    <button type="submit" onClick={submit}>
      Save
    </button>
    <button type="button" onClick={onReset}>
      Cancel
    </button>
  </div>
);

const fieldTypes = {
  text: ({value, onChange}) => <input value={value} onChange={onChange} />,
};

const KForm = compose(
  withScope,
  defaultProps({
    formTemplate: FormTemplate,
    formGroupTemplate: FormGroupTemplate,
    buttonsTemplate: ButtonsTemplate,
    fieldTypes: fieldTypes,
  })
)(ElmForm);

export default KForm;

export {validateForm, validateField};

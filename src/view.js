import React, {
  createElement,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useContext,
  PureComponent,
} from 'react';
import {
  filter,
  map,
  identity,
  find,
  addIndex,
  compose,
  mapObjIndexed,
  fromPairs,
  mergeRight,
  has,
  reduceBy,
  propOr,
  pathOr,
} from 'ramda';
import withDebug from './withDebug';
import {setField, submit, reset, setSubmitDirty} from './actions';
import {
  visibleFieldsSelectorCreator,
  indexedSchemaSelector,
  fieldTypesSelector,
} from './selectors';
import {createUpdater} from './updater';
import {withProps, defaultProps} from 'recompose';
import {
  fetchOnEvery,
  handleAsyncs,
  KLogicContext,
  withScope,
  useKReducer,
  bindActionCreators,
} from 'k-logic';
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

const useFrozenReducer = (reducer, actions) => {
  const context = useContext(KLogicContext);

  useLayoutEffect(() => {
    const reducerPath = [...context.scope, '.'];
    context.assocReducer(reducerPath, reducer);
    return () => {
      context.dissocReducer(reducerPath);
    };
  }, []);

  //TODO: performance
  const initialState = reducer(undefined, {type: '@@INIT'});

  const result = useMemo(
    () => ({
      ...bindActionCreators(actions, context.dispatch),
      ...initialState,
    }),
    []
  );

  return result;
};

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
    this.getModel = this.getModel.bind(this);
    this.visibleFieldsSelector = visibleFieldsSelectorCreator();
    this.state = {fields: {}};
  }

  getModel() {
    return this.state;
  }

  componentDidMount() {
    const visibleFields = this.visibleFieldsSelector(
      this.getModel(),
      this.props
    );
    if (visibleFields && visibleFields.length > 0) {
      const firstField = visibleFields[0];
      const firstControl = this.controls[firstField.id];
      if (firstControl && firstControl.focus) {
        firstControl.focus();
      }
    }
    this.context.assocReducer(
      [...this.context.scope, '.'],
      createUpdater(this.props.fieldTypes, this.props.schema)
    );
    /*this.context.subscribe(() => {
      const state = pathOr({}, this.context.scope, this.context.getState());
      this.setState(state);
    });*/
  }

  componentWillUnmount() {
    this.context.dissocReducer([...this.context.scope, '.']);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.asyncErrors !== this.props.asyncErrors) {
      const fields = this.visibleFieldsSelector(this.getModel(), this.props);
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

    const fields = mergeRight(fieldsDefaults, model.fields);

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

    const fields = this.visibleFieldsSelector(model, {
      ...this.props,
      handleOnChange: this.handleOnChange,
    });

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

const formActions = {
  setField,
  setSubmitDirty,
  submit,
};

class EnhancedInput extends PureComponent {
  constructor() {
    super();
    this.onChange = this.onChange.bind(this);
  }

  onChange(event) {
    const value = !event.target
      ? event
      : this.props.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    this.props.onChange(value, this.props.id);
  }

  render() {
    const {component, id, ...rest} = this.props;
    return createElement(component, {
      id,
      ...rest,
      onChange: this.onChange,
    });
  }
}

const Field = ({
  id,
  formGroupTemplate,
  formName,
  label,
  onChange,
  component,
  fieldSchema,
}) => {
  const context = useContext(KLogicContext);

  const [state, setState] = useState(
    pathOr({}, [...context.scope, 'fields', id], context.getState())
  );

  const stateRef = useRef(state);

  useLayoutEffect(() => {
    return context.subscribe(() => {
      const newState = pathOr(
        {},
        [...context.scope, 'fields', id],
        context.getState()
      );
      if (newState !== stateRef.current) {
        setState(newState);
        stateRef.current = newState;
      }
    });
  }, []);

  const field = useMemo(
    () => {
      const model = pathOr(
        {fields: {}, debouncing: {}},
        context.scope,
        context.getState()
      );
      const error = validateField(fieldSchema, model);
      return createElement(formGroupTemplate, {
        label,
        input: createElement(EnhancedInput, {
          component,
          id: (formName || '') + (formName ? '-' : '') + id,
          label,
          /*value:
            fields[
              f.debounce && has(`${f.id}_raw`, fields) ? `${f.id}_raw` : f.id
            ],
            */
          value: state,
          onChange: onChange,
          //type: f.type || 'text',
          error,
          //runValidation: model.submitDirty && model.dirty,
          scope: `sub.${id}`,
          //...(f.props ? f.props(this.props.args, fields) : {}),
        }),
        error,
      });
    },
    [state]
  );

  return field;
};

const Form2 = withScope(
  ({
    name,
    formTemplate,
    formGroupTemplate,
    buttonsTemplate,
    onSubmit,
    fieldTypes,
    schema,
    resetOnSubmit,
  }) => {
    const context = useContext(KLogicContext);
    const fields0 = useMemo(() => {}, []);
    const reducer = useMemo(() => createUpdater(fieldTypes, schema), []);
    const {setField, submit, setSubmitDirty} = useFrozenReducer(
      reducer,
      formActions
    );

    const defaultSubmitHandler = useCallback(e => {
      console.log('defaultSubmitHandler');
      const asyncErrors = {};
      const model = pathOr({}, context.scope, context.getState());
      const formErrors = validateForm(schema, model, asyncErrors || {});
      const syncErrors = filter(e => e.error, formErrors);
      console.log(formErrors);

      syncErrors.length === 0
        ? submit({
            fields: model.fields,
            resetOnSubmit: boolWithDefault(true, resetOnSubmit),
          })
        : setSubmitDirty();
    }, []);

    const handleSubmit = useCallback(
      e => {
        e.preventDefault();
        return onSubmit
          ? onSubmit(defaultSubmitHandler, fields0)
          : defaultSubmitHandler();
      },
      [defaultSubmitHandler, onSubmit, fields0]
    );

    const setFieldValue = useCallback((value, id) => {
      //const model = this.getModel();
      //const fields = indexedSchemaSelector(model, this.props);
      /*const field = fields[id];
      if (field.debounce) {
        setField(id, value, 'start');
        clearTimeout(this.timeouts[id]);
        this.timeouts[id] = setTimeout(
          () => setField(id, value, 'end'),
          field.debounce
        );
      } else {*/
      setField(id, value);
      //}
    });

    const handleOnChange = useCallback(
      (value, fieldId) => setFieldValue(value, fieldId),
      []
    );

    const buttons = useMemo(
      () =>
        console.log('buttons rendered') ||
        createElement(buttonsTemplate, {
          submit: handleSubmit,
          onReset: handleSubmit,
        }),
      [buttonsTemplate, handleSubmit]
    );
    const genericError = <div>genericError</div>;
    const legend = <div>legend</div>;

    const groupFields = useCallback(
      (acc, f) =>
        console.log('xxx', f) ||
        acc.concat(
          <Field
            key={(name || '') + (name ? '-' : '') + f.id}
            id={f.id}
            label={f.label}
            formGroupTemplate={formGroupTemplate}
            formName={name}
            onChange={handleOnChange}
            fieldSchema={f}
            component={fieldTypes[f.type || 'text']}
          />
        ),
      [formGroupTemplate, fieldTypes, name]
    );

    const renderedFields = useMemo(
      () => reduceBy(groupFields, [], propOr('default', 'group'), schema),
      [schema]
    );

    console.log(renderedFields);

    const renderedForm = useMemo(
      () =>
        createElement(formTemplate, {
          fields: renderedFields,
          buttons,
          genericError,
          legend,
          submit: handleSubmit,
        }),
      [buttons, renderedFields]
    );

    return renderedForm;
  }
);

const FormTemplate = ({fields, buttons}) => (
  <div>
    {fields.default} {buttons}
  </div>
);

const FormGroupTemplate = ({label, input, error}) => (
  <div>
    {label} {input} {error}
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

Form2.defaultProps = {
  formTemplate: FormTemplate,
  formGroupTemplate: FormGroupTemplate,
  buttonsTemplate: ButtonsTemplate,
  fieldTypes: fieldTypes,
};

export default KForm;

export {validateForm, validateField, Form2};

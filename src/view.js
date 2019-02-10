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
  memo,
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
  path,
  reduceBy,
  propOr,
  pathOr,
  keys,
  flip,
  indexBy,
  prop,
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
  shallowEqual,
} from 'k-logic';
const mapWithKey = addIndex(map);

const mergeProps = propName => props => ({
  ...props,
  ...props[propName],
  [propName]: null,
});

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

  const getFields = useCallback(
    () => pathOr({}, [...context.scope, 'fields'], context.getState()),
    []
  );

  //TODO: performance
  const initialState = reducer(undefined, {type: '@@INIT'});

  const result = useMemo(
    () => ({
      ...bindActionCreators(actions, context.dispatch),
      ...initialState,
      getFields,
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

const Field = memo(
  ({
    id,
    formGroupTemplate,
    formName,
    title,
    onChange,
    component,
    fieldSchema,
    props,
  }) => {
    const context = useContext(KLogicContext);

    const [state, setState] = useState(
      pathOr(
        fieldSchema.defaultValue || '',
        [...context.scope, 'fields', id],
        context.getState()
      )
    );

    const stateRef = useRef(state);

    useLayoutEffect(() => {
      return context.subscribe(() => {
        const newState = path(
          [...context.scope, 'fields', id],
          context.getState()
        );
        if (newState !== stateRef.current) {
          setState(newState);
          stateRef.current = newState;
        }
      });
    }, []);

    const propsKeys = useMemo(() => keys(props), []);
    const propsValues = map(k => props[k], propsKeys);

    const formattedValue = useMemo(
      () => (fieldSchema.format ? fieldSchema.format(state) : state),
      [state]
    );

    const handleOnChange = useCallback(
      e => {
        const value = !e.target ? e : e.target.value;
        const parsedValue = fieldSchema.parse
          ? fieldSchema.parse(value)
          : value;

        onChange(parsedValue, id);
      },
      [id, onChange]
    );

    const field = useMemo(
      () => {
        const model = pathOr(
          {fields: {}, debouncing: {}},
          context.scope,
          context.getState()
        );
        const error = validateField(fieldSchema, model);
        return createElement(formGroupTemplate, {
          title,
          input: createElement(component, {
            id: (formName || '') + (formName ? '-' : '') + id,
            title,
            /*value:
            fields[
              f.debounce && has(`${f.id}_raw`, fields) ? `${f.id}_raw` : f.id
            ],
            */
            value: formattedValue,
            onChange: handleOnChange,
            //type: f.type || 'text',
            error,
            //runValidation: model.submitDirty && model.dirty,
            scope: `sub.${id}`,
            ...(props || {}),
          }),
          error,
        });
      },
      [state, ...propsValues]
    );

    return field;
  },
  (props, nextProps) =>
    shallowEqual(mergeProps('props')(props), mergeProps('props')(nextProps))
);

const emptyObject = {};

const Form = compose(
  flip(memo)((props, nextProps) =>
    shallowEqual(mergeProps('args')(props), mergeProps('args')(nextProps))
  ),
  withScope
)(
  ({
    name,
    legend,
    formTemplate,
    formGroupTemplate,
    buttonsTemplate,
    onSubmit,
    onReset,
    fieldTypes,
    schema,
    resetOnSubmit,
    cancelText,
    submitText,
    additionalButtons,
    args,
  }) => {
    const context = useContext(KLogicContext);
    const reducer = useMemo(() => createUpdater(fieldTypes, schema), []);
    const {setField, submit, setSubmitDirty, getFields} = useFrozenReducer(
      reducer,
      formActions
    );

    const argsRef = useRef(args);
    useEffect(
      () => {
        argsRef.current = args;
      },
      [args]
    );

    const indexedSchema = useMemo(() => indexBy(prop('id'), schema), []);

    const defaultSubmitHandler = useCallback(e => {
      const asyncErrors = {};
      const model = pathOr({}, context.scope, context.getState());
      const formErrors = validateForm(schema, model, asyncErrors || {});
      const syncErrors = filter(e => e.error, formErrors);

      syncErrors.length === 0
        ? submit({
            fields: model.fields,
            resetOnSubmit: boolWithDefault(true, resetOnSubmit),
          })
        : setSubmitDirty();
    }, []);

    const defaultResetHandler = useCallback(() => {}, []);

    const handleSubmit = useCallback(
      e => {
        e.preventDefault();
        return onSubmit
          ? onSubmit(defaultSubmitHandler, getFields())
          : defaultSubmitHandler();
      },
      [defaultSubmitHandler, onSubmit]
    );

    const handleReset = useCallback(e => {
      e.preventDefault();
      return onReset ? onReset(defaultResetHandler) : defaultResetHandler();
    });

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

    const handleOnChange = useCallback((value, fieldId) => {
      const fieldSchema = indexedSchema[fieldId];

      if (fieldSchema.onChange) {
        const appState = context.getState();
        const fieldsValues = pathOr({}, [...context.scope, 'fields'], appState);
        const currentValue = prop(fieldId, fieldsValues);
        const overriddenValue =
          fieldSchema.onChange({
            value,
            args: argsRef.current,
            fields: fieldsValues,
          }) || value;
        if (overriddenValue !== currentValue) {
          setFieldValue(overriddenValue, fieldId);
        }
      } else {
        setFieldValue(value, fieldId);
      }
    }, []);

    const buttons = useMemo(
      () =>
        createElement(buttonsTemplate, {
          onSubmit: handleSubmit,
          onReset: handleReset,
          formName: name,
          cancelText,
          submitText,
          dirty: false,
        }),
      [buttonsTemplate, handleSubmit, name, cancelText, submitText]
    );
    const genericError = <div>genericError</div>;

    const argsKeys = useMemo(() => keys(args), []);
    const argsValues = map(k => args[k], argsKeys);

    const groupFields = useCallback(
      (acc, f) =>
        acc.concat(
          <Field
            key={(name || '') + (name ? '-' : '') + f.id}
            id={f.id}
            title={f.title}
            formGroupTemplate={formGroupTemplate}
            formName={name}
            onChange={handleOnChange}
            fieldSchema={f}
            component={fieldTypes[f.type || 'text']}
            props={f.props ? f.props(args) : emptyObject}
          />
        ),
      [formGroupTemplate, fieldTypes, name, ...argsValues]
    );

    const renderedFields = useMemo(
      () => reduceBy(groupFields, [], propOr('default', 'group'), schema),
      [schema, ...argsValues]
    );

    const renderedForm = useMemo(
      () =>
        createElement(formTemplate, {
          fields: renderedFields,
          buttons,
          genericError,
          legend,
          onSubmit: handleSubmit,
          args,
        }),
      [buttons, renderedFields, ...argsValues]
    );

    return renderedForm;
  }
);

const FormTemplate = ({fields, buttons}) => (
  <div>
    {fields.default} {buttons}
  </div>
);

const FormGroupTemplate = ({title, input, error}) => (
  <div>
    <div>
      {title} {input}
    </div>
    <div style={{color: 'red'}}>{error}</div>
  </div>
);

const ButtonsTemplate = ({onSubmit, onReset}) => (
  <div>
    <button type="submit" onClick={onSubmit}>
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

Form.defaultProps = {
  formTemplate: FormTemplate,
  formGroupTemplate: FormGroupTemplate,
  buttonsTemplate: ButtonsTemplate,
  fieldTypes: fieldTypes,
  cancelText: 'Cancel',
  submitText: 'Submit',
};

export {validateForm, validateField, Form};

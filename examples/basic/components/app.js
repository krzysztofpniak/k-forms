import React, {memo, useCallback} from 'react';
import {Form} from '../../../src/main';
import {required} from '../../../src/validators';
import {createReducer, actionType2} from 'k-reducer';
import {Scope, withScope, useKReducer} from 'k-logic';
import {over, lensProp, add, compose} from 'ramda';

const parseIntNull = v => {
  const parsed = parseInt(v, 10);
  return isNaN(parsed) ? null : parsed;
};

const schema2 = [
  {
    id: 'name',
    title: 'Name',
    validate: required,
  },
  {
    id: 'age',
    title: 'Age',
    defaultValue: 10,
    parse: parseIntNull,
    format: v => (v ? v : ''),
    onChange: console.log,
    validate: v => (v < 18 ? 'At least 18 years' : null),
  },
];

const counterReducer = createReducer({counter: 0}, [
  actionType2('INC', over(lensProp('counter'), add(1))),
]);

const counterActions = {
  inc: () => ({type: 'INC'}),
};

const Expand = compose(
  memo,
  withScope
)(({color}) => {
  const {counter, inc} = useKReducer(counterReducer, counterActions);
  return (
    <div>
      <div>first</div>
      <button
        style={{backgroundColor: color || 'white', color: 'white'}}
        onClick={inc}
        type="button"
      >
        {`Hopla ${counter}`}
      </button>
    </div>
  );
});

const Input = ({value, onChange, inputRef, type}) => (
  <input value={value} onChange={onChange} ref={inputRef} type={type} />
);

const fieldTypes = {
  text: Input,
  password: Input,
  email: Input,
  expand: Expand,
};

const schema1 = [
  {
    id: 'name',
    title: 'Name',
    defaultValue: 'John',
  },
  {
    id: 'surname',
    title: 'Surname',
    defaultValue: '',
    validate: required,
  },
  {
    id: 'job',
    title: 'Job',
    type: 'expand',
  },
  {
    id: 'job2',
    title: 'Job 2',
    type: 'expand',
    props: ({color}) => ({color}),
  },
];

const Row = ({input, title, error}) => (
  <div style={{margin: '10px 0'}}>
    <div>{title}</div>
    <div>{input}</div>
    <div style={{color: 'red'}}>{error}</div>
  </div>
);

const FormTemplate = ({buttons, fields, args, onSubmit}) => (
  <form onSubmit={onSubmit}>
    <div
      style={{
        border: `2px solid ${args.color}`,
        borderRadius: '5px',
        padding: '10px',
      }}
    >
      {buttons}
      {fields.default}
      {buttons}
    </div>
  </form>
);

const Button = ({onSubmit, onReset}) => (
  <div>
    <button onClick={onSubmit} type="submit">
      Commit
    </button>
  </div>
);

const colors = ['red', 'green', 'blue'];

const appActions = {
  nextColor: () => ({type: 'NextColor'}),
};

const appReducer = createReducer({colorIndex: 0}, [
  actionType2(appActions.nextColor, s => ({
    ...s,
    colorIndex: (s.colorIndex + 1) % colors.length,
  })),
]);

const SimpleButton = memo(({text, onClick, color}) => (
  <button
    type="button"
    onClick={onClick}
    style={{backgroundColor: color, color: 'white'}}
  >
    {text}
  </button>
));

const App = () => {
  const {colorIndex, nextColor} = useKReducer(appReducer, appActions);
  const handleSubmit = useCallback((defaultSubmitHandler, fields) => {
    const errors = defaultSubmitHandler();
    if (errors.length === 0) {
      alert(JSON.stringify(fields, null, 2));
    }
  }, []);

  return (
    <Scope scope="app">
      <SimpleButton text="Next Color" onClick={nextColor} />
      <div>First Form</div>
      <Form
        scope="form0"
        autoFocus
        schema={schema1}
        fieldTypes={fieldTypes}
        args={{color: colors[colorIndex]}}
        onSubmit={handleSubmit}
      />
      <div>Second Form</div>
      <Form
        scope="form2"
        schema={schema2}
        fieldTypes={fieldTypes}
        formGroupTemplate={Row}
        formTemplate={FormTemplate}
        buttonsTemplate={Button}
        args={{color: colors[colorIndex]}}
      />
    </Scope>
  );
};

export default App;

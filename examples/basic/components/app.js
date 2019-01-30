import React, {memo, useCallback} from 'react';
import {Form} from '../../../src/main';
import {required} from '../../../src/validators';
import {createReducer, actionType2} from 'k-reducer';
import {Scope, withScope, useKReducer} from 'k-logic';
import {over, lensProp, add, compose} from 'ramda';

const schema2 = [
  {
    id: 'name',
    title: 'Name',
  },
  {
    id: 'age',
    title: 'Age',
    defaultValue: '10',
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
        style={{backgroundColor: color || 'white'}}
        onClick={inc}
        type="button"
      >
        {`Hopla ${counter}`}
      </button>
    </div>
  );
});

const fieldTypes = {
  text: ({value, onChange}) => <input value={value} onChange={onChange} />,
  expand: Expand,
};

const schema1 = [
  {
    id: 'name',
    title: 'Name',
    defaultValue: 'Jaśko',
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
  <div style={{border: 'solid red 1px'}}>
    <div>{title}</div>
    <div>{input}</div>
    <div>{error}</div>
  </div>
);

const FormTemplate = ({buttons, fields}) => (
  <div>
    {buttons}
    {fields.default}
    {buttons}
  </div>
);

const Button = ({submit, onReset}) => (
  <div>
    <button onClick={submit}>Zatwierdź</button>
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

const SimpleButton = memo(({text, onClick}) => (
  <button type="button" onClick={onClick}>
    {text}
  </button>
));

const App = () => {
  const {colorIndex, nextColor} = useKReducer(appReducer, appActions);
  const handleSubmit = useCallback((defaultSubmitHandler, fields) => {
    defaultSubmitHandler();
    console.log(fields);
  }, []);

  return (
    <Scope scope="app">
      <SimpleButton text="Next Color" onClick={nextColor} />
      <div>pierwszy form</div>
      <Form
        scope="form0"
        schema={schema1}
        fieldTypes={fieldTypes}
        args={{color: colors[colorIndex]}}
        onSubmit={handleSubmit}
      />
      <div>drugi form</div>
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

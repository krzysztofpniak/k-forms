import {
  mapObjIndexed,
  evolve,
  always,
  lensProp,
  set,
  assoc,
  prop,
  curry,
  merge,
  applySpec,
  compose,
  converge,
  propEq,
  uncurryN,
  view,
  map,
  defaultTo,
  filter,
  lensPath,
  over,
  fromPairs,
} from 'ramda';
import {createReducer, actionType, actionType2} from 'k-reducer';
import {SET_FIELD, SUBMIT, RESET, SET_SUBMIT_DIRTY} from './actionTypes';

const mergeSpec = curry((spec, obj) => merge(obj, applySpec(spec)(obj)));

const getInitialModel = (fields, subStates) => ({
  dirty: false,
  debouncing: {},
  submitDirty: false,
  fields: fields || {},
  subStates: subStates || {},
  defaultValues: fields || {},
  initialSubStates: subStates || {},
});

const initialModel = getInitialModel();

const setFields = (model, fields) =>
  set(lensProp('fields'), {...model.fields, ...fields}, model);

const reset = mergeSpec({
  dirty: always(false),
  submitDirty: always(false),
  fields: prop('defaultValues'),
  subStates: prop('initialSubStates'),
});

const setFieldsAndDefaults = (model, fields) =>
  model
    .set('fields', {...model.fields, ...fields})
    .set('defaultValues', {...model.defaultValues, ...fields});

const setSubStates = (model, subStates) =>
  model.set('subStates', {...model.subStates, ...subStates});

/*
const createUpdater = subUpdaters => {
    const updater = new Updater(initialModel)
        .case(SET_FIELD, (model, {payload: {name, value, debounce}}) => model
            .set('dirty', true)
            .updateIn(['debouncing', name], debouncing => debounce === 'start' ? true  : debounce === 'end' ? false : debouncing)
            .setIn(['fields', debounce === 'start' ? `${name}_raw` : name], value))
        .case(SUBMIT, (model, {payload: {resetOnSubmit}}) =>
            resetOnSubmit ?
                reset(model) :
                model.set('submitDirty', false).set('dirty', false))
        .case(RESET, (model, {payload: {resetOnCancel}}) =>
            resetOnCancel ?
                reset(model) :
                model)
        .case(SET_SUBMIT_DIRTY, model => model.set('submitDirty', true));

    mapObjIndexed((subUpdater, key) => {
        updater.case(key, (model, action) => model
            .updateIn(['subStates', action.matching.args.param], subUpdater, action)
            .updateIn(['fields', action.matching.args.param], f => action.setField ? action.setField.value : f),
            Matchers.parameterizedMatcher);
    }, subUpdaters || {});

    return updater.toReducer();
};
*/

const evolveSpec = compose(
  evolve,
  applySpec
);

//const actionType = (type, transform) =>
// (state, action) => propEq('type', type, action) ? uncurryN(2, transform)(action.payload, state) : state;

const zz = (pattern, subLocator, subReducer) => {
  const regexp = new RegExp(`^${pattern}\\.([^.]+)\\.(.+)`);

  return (state, action) => {
    const match = action.type.match(regexp);
    if (match) {
      const componentId = match[1];
      const subActionType = match[2];
      const subAction = {
        ...action,
        type: subActionType,
      };

      const subStateLens = lensPath(subLocator(componentId));
      const subState = view(subStateLens, state);
      const initializedState = subState
        ? state
        : set(
            subStateLens,
            subReducer(undefined, {type: '@@NEST_INIT'}),
            state
          );

      // console.log(componentId, subAction, initializedState);
      return over(
        subStateLens,
        subState => subReducer(subState, subAction),
        initializedState
      );
    }

    return state;
  };
};

/*

evolveSpec({
    subStates: converge(set, [compose(lensProp, prop('param')), prop('payload')])
}))
 */

const getFieldType = compose(
  defaultTo('text'),
  prop('type')
);

const createUpdaterCreator = subUpdaters => {
  const getSubStates = compose(
    fromPairs,
    map(f => [
      f.id,
      subUpdaters[getFieldType(f)].reducer(undefined, {type: '@@INIT'}),
    ]),
    filter(
      f => subUpdaters[getFieldType(f)] && subUpdaters[getFieldType(f)].reducer
    )
  );

  return schema => {
    const missingTypes = filter(f => !subUpdaters[getFieldType(f)], schema);
    if (missingTypes.length > 0) {
      console.error(
        'missing types registration for following fields',
        missingTypes
      );
    }
    const fields = compose(
      fromPairs,
      map(f => [f.id, f.defaultValue || ''])
    )(schema);
    const subStates = getSubStates(schema);
    const initialModel = getInitialModel(fields, subStates);

    const subReducers = compose(
      map(f =>
        zz(
          `SetSubState.${getFieldType(f)}`,
          param => ['subStates', param],
          subUpdaters[getFieldType(f)].reducer
        )
      ),
      filter(f => subUpdaters[getFieldType(f)].reducer)
    )(schema);

    const reducer = createReducer(initialModel, [
      actionType(SET_FIELD, ({name, value}) =>
        evolve({
          dirty: always(true),
          fields: {
            [name]: always(value),
          },
        })
      ),
      actionType(SUBMIT, ({resetOnSubmit}) =>
        mergeSpec({
          dirty: always(false),
          submitDirty: always(false),
          fields: prop(resetOnSubmit ? 'defaultValues' : 'fields'),
          subStates: prop(resetOnSubmit ? 'initialSubStates' : 'subStates'),
        })
      ),
      actionType(RESET, ({resetOnCancel}) =>
        mergeSpec({
          dirty: always(false),
          submitDirty: always(false),
          fields: prop(resetOnCancel ? 'defaultValues' : 'fields'),
          subStates: prop(resetOnCancel ? 'initialSubStates' : 'subStates'),
        })
      ),
      actionType2(SET_SUBMIT_DIRTY, assoc('submitDirty', true)),
      //...subReducers,
    ]);

    return reducer;
  };
};

export {
  getInitialModel,
  createUpdaterCreator,
  setFields,
  setFieldsAndDefaults,
  setSubStates,
  reset,
};

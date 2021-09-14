/**
 * JSONAPI uses `included` only at the top level. To recursively add models to this array,
 * we preserve the top-level object and pass it in to the next round
 * Because objects can have multiple relationships, we do a check of the array to make sure
 * it's not already there.
 * @method addIncluded
 * @param {Object} store
 * @param {Object} encodedData the jsonapi document
 * @param {Object} topLevel the object with `inlcluded` array
 */
const addIncluded = (store, encodedModel, included, allEncoded = [encodedModel]) => {
  const { relationships } = encodedModel

  Object.keys(relationships).forEach((key) => {
    let { data } = relationships[key]
    if (!Array.isArray(data)) {
      data = [data]
    }

    const notAlreadyIncluded = data.filter(
      ({ id, type }) => !allEncoded.some((encodedModel) => encodedModel.type === type && encodedModel.id === id)
    )

    notAlreadyIncluded.forEach((relationship) => {
      const relatedModel = store.getOne(relationship.type, relationship.id)
      const encodedRelatedModel = toFullJsonapi(relatedModel)
      included.push(encodedRelatedModel)
      addIncluded(store, encodedRelatedModel, included, [...allEncoded, ...included, encodedModel])
    })
  })
}

/**
 * Encodes models into full compliant JSONAPI payload, as if it were being sent with all
 * relevant relationships and inclusions. The resulting payload will look like
 * {
 *   data: {
 *     id: '1',
 *     type: 'zones',
 *     attributes: {},
 *     relationships: {},
 *   },
 *   included: []
 * }
 * @method serverResponse
 * @param {*} modelOrArray the data being encoded
 * @return {String} JSON encoded data
 */

export const serverResponse = function (modelOrArray) {
  let model
  let array
  let encodedData

  if (modelOrArray == null) {
    throw new Error('Cannot encode a null reference')
  } else if (Array.isArray(modelOrArray)) {
    array = modelOrArray
  } else {
    model = modelOrArray
  }

  if (model) {
    encodedData = {
      data: toFullJsonapi(model),
      included: []
    }

    addIncluded(model.store, encodedData.data, encodedData.included)
  } else if (array.length > 0) {
    encodedData = {
      data: array.map(toFullJsonapi),
      included: []
    }
    encodedData.data.forEach((encodedModel) => {
      addIncluded(array[0].store, encodedModel, encodedData.included, [...encodedData.data, ...encodedData.included])
    })
  } else {
    encodedData = { data: [] }
  }

  return JSON.stringify(encodedData)
}

const toFullJsonapi = (model) => {
  return model.jsonapi({ relationships: Object.keys(model.relationships) })
}

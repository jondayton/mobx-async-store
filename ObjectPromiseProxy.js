import { transaction } from 'mobx'

function ObjectPromiseProxy (promise, target) {
  target.isInFlight = true
  const tmpId = target.id
  const result = promise.then(
    async function (response) {
      if (response.status === 200 || response.status === 201) {
        const json = await response.json()
        // Update target model
        const { attributes, relationships } = json.data
        transaction(() => {
          Object.keys(attributes).forEach(key => {
            target[key] = attributes[key]
          })
          if (relationships) {
            Object.keys(relationships).forEach(key => {
              if (!relationships[key].hasOwnProperty('meta')) {
                // todo: throw error if relationship is not defined in model
                target.relationships[key] = relationships[key]
              }
            })
          }
          if (json.included) {
            target.store.createModelsFromData(json.included)
          }
        })
        // Update target isInFlight and isDirty
        target.isInFlight = false
        target.isDirty = false
        target.setPreviousSnapshot()
        transaction(() => {
          // NOTE: This resolves an issue where a record is persisted but the
          // index key is still a temp uuid. We can't simply remove the temp
          // key because there may be associated records that have the temp
          // uuid id as its only reference to the newly persisted record.
          // TODO: Figure out a way to update associated records to use the
          // newly persisted id.
          target.store.getType(target.type).records[tmpId] = target
          target.store.getType(target.type).records[target.id] = target
        })
        return target
      } else {
        target.isInFlight = false
        target.errors = { status: response.status }
        return target
      }
    },
    function (error) {
      // TODO: Handle error states correctly
      target.isInFlight = false
      target.errors = error
      throw error
      // return target
    }
  )
  // Define proxied attributes
  const attributeNames = Object.keys(target.attributeNames)
  const tempProperties = attributeNames.reduce((attrs, key) => {
    attrs[key] = {
      value: target[key],
      writable: false
    }
    return attrs
  }, {})

  Object.defineProperties(result, {
    isInFlight: { value: target.isInFlight },
    ...tempProperties
  })

  // Return promise
  return result
}

export default ObjectPromiseProxy

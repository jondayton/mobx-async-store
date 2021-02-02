/* global fetch */
import {
  autorun,
  isObservable
} from 'mobx'
import moment from 'moment'

import {
  attribute,
  relatedToOne,
  relatedToMany,
  Model,
  Store
} from 'artemis-data'

import {
  exampleRelatedToManyResponse,
  exampleRelatedToManyIncludedResponse
} from 'artemis-data/fixtures/exampleRelationalResponses'

// YYYY-MM-DD
const timestamp = moment()

class Note extends Model {
  static type = 'notes'
  static endpoint = 'notes'

  @attribute(String) description
  @relatedToOne todo
}

class Todo extends Model {
  static type = 'todos'
  static endpoint = 'todos'

  @attribute(String) title = 'NEW TODO'
  @attribute(Date) due_at = timestamp
  @attribute(Array) tags

  @relatedToMany(Note) meeting_notes
  @relatedToMany notes
}

class AppStore extends Store {
  static types = [
    Todo,
    Note
  ]
}

const mockBaseUrl = '/example_api'

const mockFetchOptions = {
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accepts': 'application/json'
  }
}

const store = new AppStore({
  baseUrl: mockBaseUrl,
  defaultFetchOptions: mockFetchOptions
})

const mockTodoData = {
  data: {
    id: '1',
    type: 'todos',
    attributes: {
      id: 1,
      title: 'Do taxes',
      created_at: timestamp.format('YYYY-MM-DD')
    }
  }
}

const mockTodoResponse = JSON.stringify(mockTodoData)

describe('Model', () => {
  beforeEach(() => {
    fetch.resetMocks()
    store.reset()
  })

  describe('initialization', () => {
    it('attributes default to specified type', () => {
      const todo = new Todo()
      expect(todo.tags).toBeInstanceOf(Array)
      const note = new Note()
      expect(note.description).toEqual('')
    })

    it('attributes can have default values', () => {
      const todo = new Todo()
      expect(todo.title).toEqual('NEW TODO')
      todo.title = 'test'
      expect(todo.title).toEqual('test')
    })

    it('attributes are observable', (done) => {
      const todo = new Todo({ title: 'one' })
      expect(isObservable(todo)).toBe(true)

      let runs = 0
      const expected = ['one', 'two', 'three']
      autorun(() => {
        expect(todo.title).toBe(expected[runs])
        runs++
        if (runs === 3) {
          done()
        }
      })

      todo.title = 'two'
      todo.title = 'three'
    })

    it('attributes are overridable in constructor', () => {
      const todo = new Todo({ title: 'Buy Milk' })
      expect(todo.title).toEqual('Buy Milk')
    })

    it('attributes can be set', () => {
      const todo = new Todo()
      todo.title = 'Do laundry'
      expect(todo.title).toEqual('Do laundry')
      todo.tags.push('chore')
      expect(todo.tags).toHaveLength(1)
      expect(todo.tags[0]).toEqual('chore')
    })

    it('relatedToOne relationship can be set', () => {
      const note = store.add('notes', {
        id: 1,
        description: 'Example description'
      })
      const todo = store.add('todos', { id: 1, title: 'Buy Milk' })
      note.todo = todo
      expect(note.todo).toEqual(todo)
    })

    it('relatedToOne relationship can be unset', () => {
      const note = store.add('notes', {
        id: 1,
        description: 'Example description'
      })
      const todo = store.add('todos', { id: 1, title: 'Buy Milk' })

      note.todo = todo
      expect(note.todo).toEqual(todo)

      note.todo = null
      expect(note.todo).toBeFalsy()
    })

    it('relatedToOne relationship adds to inverse', () => {
      const note = store.add('notes', {
        id: 1,
        description: 'Example description'
      })
      let todo = store.add('todos', { id: 1, title: 'Buy Milk' })

      note.todo = todo
      expect(todo.notes).toContain(note)
    })

    it('relatedToOne relationship removes from inverse', () => {
      const note = store.add('notes', {
        id: 1,
        description: 'Example description'
      })

      const todo = store.add('todos', { id: 1, title: 'Buy Milk' })

      note.todo = todo
      expect(todo.notes).toContain(note)

      note.todo = null
      expect(note.todo).toBeFalsy()
    })

    it('builds relatedToMany relationship with existing models', async () => {
      store.add('notes', {
        id: 1,
        description: 'Example description'
      })

      fetch.mockResponse(exampleRelatedToManyResponse)
      const todo = await store.findOne('todos', 1)

      expect(todo.title).toEqual('Do laundry')
      expect(todo.notes).toHaveLength(1)
      expect(todo.notes[0].description).toEqual('Example description')
    })

    it('builds relatedToMany relationship with included data', async () => {
      fetch.mockResponse(exampleRelatedToManyIncludedResponse)
      const todo = await store.findOne('todos', 1)

      expect(todo.title).toEqual('Do laundry')
      expect(todo.notes).toHaveLength(1)
      expect(todo.notes[0].description).toEqual('Use fabric softener')
    })

    it('builds aliased relatedToMany relationship', async () => {
      fetch.mockResponse(exampleRelatedToManyIncludedResponse)
      const todo = await store.findOne('todos', 1)

      expect(todo.title).toEqual('Do laundry')
      expect(todo.meeting_notes).toHaveLength(1)
      expect(todo.meeting_notes[0].description).toEqual('Use fabric softener')
    })
  })

  it('relatedToMany models can be added', () => {
    const note = store.add('notes', {
      id: 10,
      description: 'Example description'
    })
    const todo = store.add('todos', { id: 10, title: 'Buy Milk' })
    const { notes } = todo

    notes.add(note)

    expect(notes).toContain(note)
    expect(todo.notes).toContain(note)
  })

  it('relatedToMany models can be removed', () => {
    const note = store.add('notes', {
      id: 10,
      description: 'Example description'
    })
    const todo = store.add('todos', { id: 10, title: 'Buy Milk' })

    todo.notes.add(note)

    expect(todo.notes).toContain(note)

    todo.notes.remove(note)
    expect(todo.notes).not.toContain(note)
  })

  it('relatedToMany models adds inverse relationships', () => {
    const note = store.add('notes', {
      id: 10,
      description: 'Example description'
    })
    const todo = store.add('todos', { id: 10, title: 'Buy Milk' })

    todo.notes.add(note)

    expect(todo.notes).toContain(note)
    expect(note.todo).toEqual(todo)
  })

  it('relatedToMany models remove inverse relationships', () => {
    const note = store.add('notes', {
      id: 10,
      description: 'Example description'
    })
    const todo = store.add('todos', { id: 10, title: 'Buy Milk' })

    todo.notes.add(note)

    expect(note.todo).toEqual(todo)

    todo.notes.remove(note)

    expect(note.todo).toBeFalsy()
  })

  describe('.snapshot', () => {
    it('sets snapshot on initialization', async () => {
      const todo = new Todo({ title: 'Buy Milk' })
      expect(todo.snapshot).toEqual({
        due_at: new Date(timestamp),
        tags: [],
        title: 'Buy Milk'
      })
    })
  })

  describe('.jsonapi', () => {
    it('returns data in valid jsonapi structure with coerced values', async () => {
      const todo = new Todo({ id: 1, title: 'Buy Milk' })
      expect(todo.jsonapi()).toEqual({
        data: {
          id: '1',
          type: 'todos',
          attributes: {
            due_at: new Date(timestamp).toISOString(),
            tags: [],
            title: 'Buy Milk'
          }
        }
      })
    })

    it('relatedToMany models can be added', () => {
      const note = store.add('notes', {
        id: 11,
        description: 'Example description'
      })

      const todo = store.add('todos', { id: 11, title: 'Buy Milk' })

      todo.notes.add(note)

      expect(todo.jsonapi({ relationships: ['notes'] })).toEqual({
        data: {
          id: '11',
          type: 'todos',
          attributes: {
            due_at: new Date(timestamp).toISOString(),
            tags: [],
            title: 'Buy Milk'
          },
          relationships: {
            notes: {
              data: [{ id: '11', type: 'notes' }]
            }
          }
        }
      })
    })
  })

  describe('.isDirty', () => {
    it('is initially false', async () => {
      const todo = new Todo({ title: 'Buy Milk' })
      expect(todo.isDirty).toBeFalsy()
    })

    it('is set to true if record changes', async () => {
      const todo = new Todo({ title: 'Buy Milk' })
      todo.title = 'Do the laundry'
      expect(todo.isDirty).toBe(true)
    })
  })

  describe('.rollback', () => {
    it('rollback restores data to last persisted state ', async () => {
      const todo = new Todo({ title: 'Buy Milk' })
      expect(todo.snapshot.title).toEqual('Buy Milk')
      todo.title = 'Do Laundry'
      expect(todo.snapshot.title).toEqual('Do Laundry')
      todo.rollback()
      expect(todo.title).toEqual('Buy Milk')
      expect(todo.snapshot.title).toEqual('Buy Milk')
    })
  })

  describe('.save', () => {
    xit('handles in flight behavior', (done) => {
      // expect.assertions(3)
      // Mock slow server response
      fetch.mockResponseOnce(() => {
        return new Promise(resolve => {
          return setTimeout(() => resolve({
            body: mockTodoResponse
          }), 1000)
        })
      })

      const todo = store.add('todos', { title: 'Buy Milk' })
      expect(todo.isInFlight).toBe(false)

      todo.save()
      // Assert isInFlight is true
      expect(todo.isInFlight).toBe(true)
      // Assert title hasn't changed yet
      expect(todo.title).toEqual('Buy Milk')

      setTimeout(() => {
        expect(todo.isInFlight).toBe(false)
        expect(todo.title).toEqual('Do taxes')
        done()
      }, 1001)
    })

    it('makes request and updates model in store', async () => {
      // expect.assertions(9)
      // Add record to store
      const todo = store.add('todos', { title: 'Buy Milk' })
      // Check the model doesn't have attributes
      // only provided by an API request
      expect(todo).not.toHaveProperty('created_at')
      // Check that the model has a tmp id
      expect(todo.id).toMatch('tmp')
      // Check the the tmp id has the correct length
      expect(todo.id).toHaveLength(40)
      // Mock the API response
      fetch.mockResponse(mockTodoResponse)
      // Trigger the save function and subsequent request
      await todo.save()
      // Assert the request was made with the correct
      // url and fetch options
      expect(fetch.mock.calls).toHaveLength(1)
      expect(fetch.mock.calls[0][0]).toEqual('/example_api/todos')
      expect(fetch.mock.calls[0][1].method).toEqual('POST')
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
        data: {
          type: 'todos',
          attributes: {
            due_at: new Date(timestamp).toISOString(),
            tags: [],
            title: 'Buy Milk'
          }
        }
      })
      // Check that the id is now what was provider
      // from the server
      expect(todo.id).toEqual(1)
      // Check that the `created_at` attribute is populated
      expect(todo.created_at)
        .toEqual(timestamp.format('YYYY-MM-DD'))
    })
  })

  describe('.delete', () => {
    it('makes request and removes model from the store store', async () => {
      fetch.mockResponses([JSON.stringify({}), { status: 204 }])
      const todo = store.add('todos', { id: 1, title: 'Buy Milk' })
      expect(store.findAll('todos', { fromServer: false }))
        .toHaveLength(1)
      await todo.destroy()
      expect(fetch.mock.calls).toHaveLength(1)
      expect(fetch.mock.calls[0][0]).toEqual('/example_api/todos/1')
      expect(fetch.mock.calls[0][1].method).toEqual('DELETE')
      expect(store.findAll('todos', { fromServer: false }))
        .toHaveLength(0)
    })
  })
})

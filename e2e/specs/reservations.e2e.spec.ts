describe("Reservations",  () => {
  beforeAll(async () => {
    const user = {
      email: "diogofelipe140@gmail.com",
      password: "Password1234!"
    }

    await fetch("http://auth:3001/auth/login", {
      method: "POST",
      body: JSON.stringify(user)
    })
  })

  test("Create", async () => {

  })
})
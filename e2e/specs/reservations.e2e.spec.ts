describe("Reservations",  () => {

  let jwt: string;

  beforeAll(async () => {
    const user = {
      email: "diogofelipe140@gmail.com",
      password: "Password1234!"
    }

    await fetch("http://auth:3001/auth/users", {
      method: "POST",
      body: JSON.stringify(user),
        headers: {
          "Content-Type": "application/json"
        }
    });

    const response = await fetch("http://auth:3001/auth/login", {
      method: "POST",
      body: JSON.stringify(user),
      headers: {
        "Content-Type": "application/json"
      }
    });

    jwt = await response.text();
  });

  test("Create & Get", async () => {

    const createdReservation = await createReservation();

    const responseGet = await fetch(`http://reservation:3000/reservations/${createdReservation._id}`,
      {
        headers: {
          "Authentication": jwt
        }
      }
    );

    expect(responseGet.ok).toBeTruthy();
    const reservation = await responseGet.json();
    expect(reservation._id).toEqual(createdReservation._id);
  });

  const createReservation = async () => {
    const requestBody = {
      startDate: "12/20/2025",
      endDate: "12/20/2025",
      placeId: "placeId",
      invoiceId: "invoiceId",
      charge: {
        amount: 3,
        "card": {
          "token": "tok_visa"
        }
      }
    }

    const responseCreate = await fetch("http://reservation:3000/reservations", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
        "Authentication": jwt
      }
    });

    expect(responseCreate.ok).toBeTruthy();
    return await responseCreate.json();
  }
})
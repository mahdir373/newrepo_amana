import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { logService, fileService } from '../../services/apiService';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const pad2 = (n) => String(n).padStart(2, '0');

/* ----------------------------------
   Quarter-hour time picker
---------------------------------- */
const QuarterHourSelectTimePicker = ({ label, value, onChange }) => {
  const h = value ? value.getHours() : 0;
  const m = value ? value.getMinutes() : 0;

  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    [0, 15, 30, 45].forEach((min) => {
      options.push(`${pad2(hour)}:${pad2(min)}`);
    });
  }

  const handleChange = (e) => {
    const [HH, MM] = e.target.value.split(':').map(Number);
    const next = value ? new Date(value) : new Date();
    next.setHours(HH, MM, 0, 0);
    onChange(next);
  };

  const current = `${pad2(h)}:${pad2(m - (m % 15))}`;

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <Form.Select value={current} onChange={handleChange}>
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Form.Select>
    </Form.Group>
  );
};

/* ==================================
   Main Component
================================== */
const CreateDailyLog = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const validationSchema = Yup.object({
    date: Yup.date().required('יש להזין תאריך'),
    project: Yup.string().required('יש להזין שם פרויקט'),
    employees: Yup.array().min(1, 'יש להזין לפחות עובד אחד'),
    startTime: Yup.date().required('יש להזין שעת התחלה'),
    endTime: Yup.date()
      .required('יש להזין שעת סיום')
      .test(
        'is-after-start',
        'שעת הסיום חייבת להיות לאחר שעת ההתחלה',
        function (value) {
          const { startTime } = this.parent;
          return !startTime || !value || value > startTime;
        }
      ),
    workDescription: Yup.string().required('יש להזין תיאור עבודה'),
  });

  const initialValues = {
    date: new Date(),
    project: '',
    employees: [''],
    startTime: new Date(new Date().setHours(8, 0, 0, 0)),
    endTime: new Date(new Date().setHours(17, 0, 0, 0)),
    workDescription: '',
    deliveryCertificate: null,
    workPhotos: [],
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError('');

      const { deliveryCertificate, workPhotos, employees, ...rest } = values;

      const cleanedEmployees = employees.filter(
        (e) => e && e.trim() !== ''
      );

      /* -------- Step 1: create log (JSON only) -------- */
      const payload = {
        ...rest,
        employees: JSON.stringify(cleanedEmployees),
        date: values.date.toISOString(),
        startTime: values.startTime.toISOString(),
        endTime: values.endTime.toISOString(),
      };

      const res = await logService.createLog(payload);
      const logId = res.data?._id;

      if (!logId) {
        throw new Error('Log ID missing from response');
      }

      /* -------- Step 2: upload files (GCS) -------- */
      if (deliveryCertificate || workPhotos.length > 0) {
        const formData = new FormData();

        if (deliveryCertificate) {
          formData.append('deliveryCertificate', deliveryCertificate);
        }

        workPhotos.forEach((photo) => {
          formData.append('workPhotos', photo);
        });

        await fileService.uploadFiles(logId, formData);
      }

      toast.success('דו"ח עבודה יומי נוצר בהצלחה');
      navigate('/');
    } catch (err) {
      console.error('❌ Create log error:', err);

      const message =
        err.response?.data?.message || 'נכשל ביצירת דו"ח';

      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container dir="rtl">
      <h2 className="mb-3">יצירת דו"ח עבודה יומי</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Body>
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleSubmit,
              setFieldValue,
              isSubmitting,
            }) => (
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Label>תאריך</Form.Label>
                    <DatePicker
                      selected={values.date}
                      onChange={(d) => setFieldValue('date', d)}
                      className="form-control"
                      dateFormat="dd/MM/yyyy"
                    />
                  </Col>

                  <Col md={6}>
                    <Form.Label>שם פרויקט</Form.Label>
                    <Form.Control
                      name="project"
                      value={values.project}
                      onChange={handleChange}
                      isInvalid={touched.project && errors.project}
                    />
                  </Col>
                </Row>

                <Form.Group className="mt-3">
                  <Form.Label>עובדים נוכחים</Form.Label>
                  {values.employees.map((emp, i) => (
                    <Row key={i} className="mb-2">
                      <Col xs={10}>
                        <Form.Control
                          name={`employees[${i}]`}
                          value={emp}
                          onChange={handleChange}
                        />
                      </Col>
                      <Col xs={2}>
                        <Button
                          variant="outline-danger"
                          onClick={() => {
                            const next = [...values.employees];
                            next.splice(i, 1);
                            setFieldValue('employees', next);
                          }}
                        >
                          ✕
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  <Button
                    variant="outline-primary"
                    onClick={() =>
                      setFieldValue('employees', [...values.employees, ''])
                    }
                  >
                    הוסף עובד
                  </Button>
                </Form.Group>

                <Row className="mt-3">
                  <Col md={6}>
                    <QuarterHourSelectTimePicker
                      label="שעת התחלה"
                      value={values.startTime}
                      onChange={(d) => setFieldValue('startTime', d)}
                    />
                  </Col>
                  <Col md={6}>
                    <QuarterHourSelectTimePicker
                      label="שעת סיום"
                      value={values.endTime}
                      onChange={(d) => setFieldValue('endTime', d)}
                    />
                  </Col>
                </Row>

                <Form.Group className="mt-3">
                  <Form.Label>תיאור העבודה</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="workDescription"
                    value={values.workDescription}
                    onChange={handleChange}
                  />
                </Form.Group>

                <Form.Group className="mt-3">
                  <Form.Label>תעודת משלוח</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setFieldValue(
                        'deliveryCertificate',
                        e.currentTarget.files[0]
                      )
                    }
                  />
                </Form.Group>

                <Form.Group className="mt-3">
                  <Form.Label>תמונות עבודה</Form.Label>
                  <Form.Control
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) =>
                      setFieldValue(
                        'workPhotos',
                        Array.from(e.currentTarget.files)
                      )
                    }
                  />
                </Form.Group>

                <div className="mt-4 d-flex justify-content-between">
                  <Button variant="secondary" onClick={() => navigate('/')}>
                    ביטול
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'שולח...' : 'שמור'}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CreateDailyLog;
